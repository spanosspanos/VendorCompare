"""
/api/chat — AI chat endpoint with VendorCompare tool calling.
Uses Ollama via the OpenAI-compatible API (no API key required).
"""
import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from difflib import get_close_matches

from openai import OpenAI
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..database import get_db
from ..auth_deps import get_current_role
from ..models import (
    Price, Product, Category, Vendor, Order, OrderItem, OrderVendorSplit,
    OrderDraft, ParSetting, AuditLog, ChatMessage as ChatMessageModel, Synonym,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])

_CANOPI_SKILL_PATH = Path(
    os.environ.get("TAQUITO_SYSTEM_PROMPT_PATH")
    or Path(__file__).parents[3] / "canopi/identity/taquito.md"
)

_FALLBACK_SYSTEM_PROMPT = """You are Taquito — the ordering assistant built into VendorCompare for Cantina Taco & Tequila Bar in White Plains, NY.

You are talking to John, the owner and GM. John collects order quantities from his staff and places all orders himself. Be a friendly colleague, not a formal system. Keep it light and concise — John is busy.

YOUR WORLD IS VENDORCOMPARE. If a question cannot be associated with or executed within VendorCompare (vendors, products, prices, order assembly, PAR levels), do not attempt to answer it. Say: "That's outside VendorCompare — I'm just here for the ordering side. What can I help you with on that front?"

VENDORS:
- Food Direct (primary) — reliable pricing
- US Foods (primary) — reliable pricing
- Riviera Produce — active but pricing is often sparse; surface uncertainty if Riviera Produce data is missing or stale

PRICE STALENESS: If a price is unavailable or older than 14 days, tell John clearly and continue with what's available. Never silently use stale pricing. Never make up prices.

WHEN SEARCH RETURNS NOTHING OR MULTIPLE AMBIGUOUS MATCHES: Ask before guessing.
- Zero results: "I don't see '[query]' — did you mean [closest match], or something else?"
- Ambiguous size/count (e.g. "10 tortilla"): "Did you mean 10 units, or a 10-inch tortilla?"
- Multiple matches (e.g. both "5 Inch Flour Tortillas" and "12 Inch Flour Tortillas"): list ALL matches by name and ask which one(s) John wants. Never silently pick one.

HARD LIMITS:
- VendorCompare does not place orders with vendors. After saving, John places the order with Food Direct/US Foods/Riviera Produce through his normal channels. Never imply Taquito can transmit a vendor order.
- Assembled orders are not saved until John confirms. If the session might be interrupted, remind John to save.

NOTES — two levels, do not conflate:
- Item flag: attached to a specific product ("flag this item for John"). Use flag_item tool.
- Order note: free text for the whole order ("need by Thursday"). Use add_order_note tool.

TWO PRIMARY MODES:
1. QUICK ORDER: John lists items + quantities → search_products → assemble_order → present splits + total → save on confirmation.
2. PAR ORDER: "what do we need / PAR order / restock / weekly order" → get_par_order → assemble_order → present splits + total → save on confirmation.

If intent is unclear: "Are you placing a specific order, or want me to pull up the PAR reorder list?"

ORDER RULES:
- ALWAYS present vendor splits and total before saving.
- NEVER save without explicit confirmation ("yes", "confirm", "save it", "looks good", etc.).
- On confirmation, call save_order(draft_id, origin_route="chat") using the draft_id from the assembled order. Do not write your own saved confirmation; the app renders the verified receipt.
"""


def _load_system_prompt() -> str:
    prompt = _FALLBACK_SYSTEM_PROMPT
    try:
        if _CANOPI_SKILL_PATH.exists():
            raw = _CANOPI_SKILL_PATH.read_text()
            marker = "## System Prompt"
            idx = raw.find(marker)
            if idx != -1:
                extracted = raw[idx + len(marker):].strip()
                if extracted:
                    prompt = extracted
    except Exception as e:
        logging.warning(f"Taquito skill load failed: {e} — using fallback prompt.")
    prompt = prompt.replace('After saving: "Order saved. It\'s in the review queue."', 'On confirmation, call save_order(draft_id, origin_route="chat") using the draft_id from the assembled order. Do not write your own saved confirmation; the app renders the verified receipt.')
    prompt = prompt.replace("After saving: \"Order saved. It's in the review queue.\"", 'On confirmation, call save_order(draft_id, origin_route="chat") using the draft_id from the assembled order. Do not write your own saved confirmation; the app renders the verified receipt.')
    return prompt


SYSTEM_PROMPT = _load_system_prompt()

client = OpenAI(
    base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
    api_key="ollama",
)

MODEL = os.environ.get("VENDORCOMPARE_MODEL", "qwen2.5:7b")

# Inference parameters — tune via env vars, no code deploy needed
TAQUITO_TEMPERATURE   = float(os.environ.get("TAQUITO_TEMPERATURE",    "0.1"))
TAQUITO_TOP_P         = float(os.environ.get("TAQUITO_TOP_P",          "0.85"))
TAQUITO_TOP_K         = int(os.environ.get("TAQUITO_TOP_K",            "30"))
TAQUITO_REPEAT_PENALTY = float(os.environ.get("TAQUITO_REPEAT_PENALTY", "1.1"))

TOOLS = [
    # ── v1 ────────────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search for products by name or keyword. Returns product IDs and names. Use this to resolve product names from user input to product IDs before assembling an order. IMPORTANT: if multiple products match (e.g. different sizes of the same item), list ALL matches to the user by name and ask which one(s) they want — never silently pick one.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search term (product name, brand, or category)"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "assemble_order",
            "description": "Assemble an order: finds cheapest vendor for each item (respecting locks, excluding muted vendors), returns vendor splits, total cost, savings, and a draft_id token. Call this once you have all product IDs and quantities. Keep the draft_id for save_order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "number"}
                            },
                            "required": ["product_id", "quantity"]
                        }
                    }
                },
                "required": ["items"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_order",
            "description": "Save a previously assembled draft to the database for manager review. ONLY call after the user explicitly confirms. Pass the draft_id returned by assemble_order; do not pass/recreate item lists. Returns a verified ConfirmationReceipt only after DB readback succeeds.",
            "parameters": {
                "type": "object",
                "properties": {
                    "draft_id": {"type": "string", "description": "draft_id returned by assemble_order"},
                    "origin_route": {"type": "string", "description": "Always pass 'chat'"}
                },
                "required": ["draft_id", "origin_route"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_par_order",
            "description": "Get the PAR reorder list: all products with their PAR (standing order) quantities and current prices. Use when the user asks for a PAR order, weekly restock, or 'what do we need'.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    # ── v2 ────────────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_vendors",
            "description": "Return all active vendors with their IDs, names, and muted status. Use to resolve vendor names to IDs before calling lock_vendor, mute_vendor, set_price, etc.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_categories",
            "description": "Return all product categories with their IDs and names. Use to resolve a category name to an ID before calling add_product.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lock_vendor",
            "description": "Lock a product to a specific vendor — that vendor is always chosen regardless of price. Requires explicit confirmation. Call get_vendors to resolve vendor name to ID if needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "vendor_id": {"type": "integer"}
                },
                "required": ["product_id", "vendor_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "unlock_vendor",
            "description": "Remove the vendor lock from a product — pricing will revert to cheapest active vendor. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"}
                },
                "required": ["product_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_par_value",
            "description": "Set or update the PAR (standing order) quantity for a product. Requires confirmation. Use par_value=0 to remove from PAR order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "par_value": {"type": "number", "description": "New PAR quantity. Use 0 to remove from PAR order."}
                },
                "required": ["product_id", "par_value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mute_vendor",
            "description": "Mute a vendor — exclude them from all price comparisons. Pricing data is preserved. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_id": {"type": "integer"}
                },
                "required": ["vendor_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "unmute_vendor",
            "description": "Re-activate a muted vendor — restore them to price comparisons. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_id": {"type": "integer"}
                },
                "required": ["vendor_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_price",
            "description": "Record a manual price for a product+vendor. Use when John provides a price for an unpriced item. Takes effect immediately for future orders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "vendor_id": {"type": "integer"},
                    "price": {"type": "number", "description": "Unit price"},
                    "unit": {"type": "string", "description": "Unit description (e.g. 'case', 'each', 'lb'). Optional."}
                },
                "required": ["product_id", "vendor_id", "price"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_history",
            "description": "Retrieve recent saved orders with totals, savings, and vendor splits. Supports period filter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["week", "month", "quarter", "year", "all"],
                        "description": "Time period to filter by. Defaults to 'month'."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_spend_summary",
            "description": "Return total spent, total saved, and order count for a time period.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["week", "month", "quarter", "year", "all"],
                        "description": "Time period. Defaults to 'month'."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "note_synonym",
            "description": "Record a synonym mapping (e.g. 'chick cut' → 'chicken cutlet'). Called after John clarifies an ambiguous search. Persists and is checked on future searches.",
            "parameters": {
                "type": "object",
                "properties": {
                    "alias": {"type": "string", "description": "What John said (the alias to record)"},
                    "canonical": {"type": "string", "description": "The canonical product name it maps to"}
                },
                "required": ["alias", "canonical"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "flag_item",
            "description": "Flag a specific item on a saved order with a note for John's attention (🚩 mechanism). Must be called after save_order with the returned order_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer"},
                    "product_id": {"type": "integer"},
                    "note": {"type": "string", "description": "Flag note — reason for flagging this item"}
                },
                "required": ["order_id", "product_id", "note"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_order_note",
            "description": "Add or update an order-level note. For context like 'need by Thursday' or 'second order this week'. Separate from item-level flags.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer"},
                    "note": {"type": "string", "description": "Free text note for the whole order"}
                },
                "required": ["order_id", "note"]
            }
        }
    },
    # ── v3 ────────────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "add_product",
            "description": "Add a new product to the catalog. Requires confirmation and a valid category_id. Use get_categories to list available categories. Always check with search_products first to avoid duplicates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "category_id": {"type": "integer", "description": "Category ID from get_categories."},
                    "unit": {"type": "string", "description": "Unit description. Defaults to 'each'."}
                },
                "required": ["name", "category_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mute_product",
            "description": "Mute a product — hide it from ordering views. Data is preserved. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"}
                },
                "required": ["product_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "unmute_product",
            "description": "Restore a muted product to ordering views. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"}
                },
                "required": ["product_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "review_order",
            "description": "Approve or reject a pending order in the review queue. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer"},
                    "action": {"type": "string", "enum": ["approve", "reject"]},
                    "note": {"type": "string", "description": "Optional review note"}
                },
                "required": ["order_id", "action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "dismiss_order",
            "description": "Dismiss/archive an order from the review queue (for test orders or duplicates). Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer"},
                    "note": {"type": "string", "description": "Optional reason for dismissal"}
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_order",
            "description": "Permanently delete a pending (unreviewed) order. Only works on orders with pending review status. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer"}
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_order",
            "description": "Modify line items or the order note on a saved pending order. Providing items replaces the entire item list — pass the complete updated list. Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "number"}
                            },
                            "required": ["product_id", "quantity"]
                        },
                        "description": "Complete replacement item list (optional)."
                    },
                    "notes_to_john": {"type": "string", "description": "Updated order note (optional, replaces existing note)."}
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_pending_orders",
            "description": "Return orders currently in the review queue (pending John's approval), with items and vendor splits.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_price_pending",
            "description": "Return products with no current price from any active vendor — the PricePending list.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_price_audit_log",
            "description": "Return recent price changes: product, vendor, old price → new price, timestamp.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of entries to return. Defaults to 20."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_synonyms",
            "description": "Return all recorded synonym mappings (alias → canonical product name). For review or debugging.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
]

# ── Routing ───────────────────────────────────────────────────────────────────

_REGISTERED_TOOL_NAMES = {t["function"]["name"] for t in TOOLS}

_TOOL_ROUTING: dict[str, set[str]] = {
    "ordering": {
        "search_products", "assemble_order", "save_order", "get_par_order",
        "flag_item", "add_order_note", "note_synonym", "get_vendors",
    },
    "settings": {
        "set_par_value", "lock_vendor", "unlock_vendor",
        "mute_vendor", "unmute_vendor", "set_price",
        "get_vendors", "search_products",
    },
    "history": {
        "get_order_history", "get_spend_summary",
        "get_pending_orders", "get_price_audit_log",
    },
    "admin": {
        "add_product", "mute_product", "unmute_product",
        "review_order", "dismiss_order", "delete_order",
        "edit_order", "get_price_pending", "get_synonyms",
        "get_pending_orders", "get_vendors", "get_categories",
        "search_products",
    },
}

_SETTINGS_SIGNALS = {
    "set par", "lock", "unlock", "mute", "unmute",
    "change price", "update price", "price for", "set price",
}
_HISTORY_SIGNALS = {
    "last order", "how much", "spend", "spent", "history",
    "summary", "order history", "audit",
}
_ADMIN_SIGNALS = {
    "add product", "new product", "mute product", "unmute product",
    "review queue", "approve", "reject", "dismiss",
    "pending order", "pending review", "delete order",
    "edit order", "price pending", "unpriced", "synonyms",
}


def _classify_intent(last_user_message: str) -> str:
    text = last_user_message.lower()
    if any(s in text for s in _ADMIN_SIGNALS):
        return "admin"
    if any(s in text for s in _HISTORY_SIGNALS):
        return "history"
    if any(s in text for s in _SETTINGS_SIGNALS):
        return "settings"
    return "ordering"


def select_tools(messages: list[dict]) -> list[dict]:
    user_messages = [m["content"] for m in messages if m.get("role") == "user"]
    if not user_messages:
        return TOOLS
    intent = _classify_intent(user_messages[-1])
    allowed_names = _TOOL_ROUTING.get(intent, set()) & _REGISTERED_TOOL_NAMES
    allowed_names |= _TOOL_ROUTING["ordering"] & _REGISTERED_TOOL_NAMES
    return [t for t in TOOLS if t["function"]["name"] in allowed_names]


# ── Session context ───────────────────────────────────────────────────────────

def _get_catalog_context(db: Session) -> str | None:
    try:
        products = (
            db.query(Product)
            .filter(Product.is_deleted == False)
            .order_by(Product.name)
            .all()
        )
        if not products:
            return None
        cat_ids = {p.category_id for p in products}
        cats = {c.id: c.name for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()}
        vendors = db.query(Vendor).filter(Vendor.is_muted == False, Vendor.is_deleted == False).all()

        lines = ["JOHN'S PRODUCT CATALOG — use these exact IDs when calling tools:"]
        current_cat = None
        for p in products:
            cat = cats.get(p.category_id, "Other")
            if cat != current_cat:
                lines.append(f"\n[{cat}]")
                current_cat = cat
            muted_tag = " [MUTED — hidden from ordering; use unmute_product to restore]" if p.muted else ""
            lines.append(f"  ID:{p.id} {p.name}{muted_tag}")

        if vendors:
            lines.append("\nACTIVE VENDORS: " + ", ".join(v.name for v in vendors))

        synonyms = db.query(Synonym).filter(Synonym.location_id == 1).all()
        if synonyms:
            lines.append("KNOWN ALIASES: " + "; ".join(f"{s.alias}={s.canonical}" for s in synonyms))

        return "\n".join(lines)
    except Exception:
        return None


def _get_session_context(db: Session) -> str | None:
    try:
        pending_count = (
            db.query(Order)
            .filter(Order.review_status == "pending")
            .count()
        )
        last_order = (
            db.query(Order)
            .filter(Order.status == "saved")
            .order_by(Order.created_at.desc())
            .first()
        )
        parts = []
        if pending_count > 0:
            noun = "order" if pending_count == 1 else "orders"
            parts.append(f"{pending_count} {noun} pending your review")
        if last_order:
            date_str = last_order.created_at.strftime("%a %b %-d") if last_order.created_at else "recently"
            total_str = f"${last_order.total_cost:.0f}" if last_order.total_cost else ""
            parts.append(f"last order {date_str}{' ' + total_str if total_str else ''}")
        if not parts:
            return None
        return "Session context — " + ", ".join(parts) + "."
    except Exception:
        return None


# ── Pydantic request models ───────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str
    draft_id: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    draft_id: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _period_cutoff(period: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    mapping = {"week": 7, "month": 30, "quarter": 90, "year": 365}
    days = mapping.get(period)
    return now - timedelta(days=days) if days else None


def _latest_draft_id(request: ChatRequest) -> str | None:
    if request.draft_id:
        return request.draft_id
    for message in reversed(request.messages):
        if message.draft_id:
            return message.draft_id
    return None


_QUANTITY_PRODUCT_RE = re.compile(
    r"(?:^|\b)(?:i\s+need|need|add|order|put\s+in|grab|get|want)?\s*"
    r"(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
    r"[a-z][a-z0-9'\- ]*\b",
    re.IGNORECASE,
)
_ARTICLE_ORDER_RE = re.compile(
    r"\b(?:i\s+need|need|add|order|put\s+in|grab|get|want)\s+(?:a|an)\s+[a-z][a-z0-9'\- ]*\b",
    re.IGNORECASE,
)
_ORDER_VERB_RE = re.compile(r"\b(?:i\s+need|need|add|order|put\s+in|grab|get|want)\b", re.IGNORECASE)
_SAVE_CONFIRMATION_RE = re.compile(
    r"\b(?:save\s+it|save\s+that|save\s+this|confirm(?:ed)?|yes\s*,?\s*save|looks\s+good|go\s+ahead|send\s+it)\b",
    re.IGNORECASE,
)


def _looks_like_order_request(message: str | None) -> bool:
    if not message:
        return False
    text = " ".join(message.strip().split())
    if not text:
        return False
    if _QUANTITY_PRODUCT_RE.search(text):
        return True
    if _ARTICLE_ORDER_RE.search(text):
        return True
    return bool(_ORDER_VERB_RE.search(text) and re.search(r"\d", text))


def _looks_like_save_confirmation(message: str | None) -> bool:
    if not message:
        return False
    return bool(_SAVE_CONFIRMATION_RE.search(message.strip()))


def _safe_no_draft_reply() -> str:
    return (
        "I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. "
        "Please choose the exact product or try again with the catalog name."
    )


# ── Tool implementations ──────────────────────────────────────────────────────

def _tool_search_products(query: str, db: Session) -> dict:
    q = query.lower()
    products = db.query(Product).filter(
        Product.muted == False,
        Product.is_deleted == False,
    ).all()
    cat_ids = {p.category_id for p in products}
    cats = {c.id: c.name for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()}

    # 1. Exact substring match
    matches = []
    for p in products:
        if q in p.name.lower():
            matches.append({
                "product_id": p.id,
                "name": p.name,
                "category": cats.get(p.category_id, ""),
                "fuzzy_match": False,
            })

    # 2. Synonym lookup — translate alias to canonical, re-search
    if not matches:
        synonym = db.query(Synonym).filter(
            func.lower(Synonym.alias) == q,
            Synonym.location_id == 1,
        ).first()
        if synonym:
            canonical_q = synonym.canonical.lower()
            for p in products:
                if canonical_q in p.name.lower():
                    matches.append({
                        "product_id": p.id,
                        "name": p.name,
                        "category": cats.get(p.category_id, ""),
                        "fuzzy_match": False,
                        "via_synonym": synonym.canonical,
                    })

    # 3. Fuzzy fallback
    if not matches:
        product_names = [p.name for p in products]
        fuzzy_names = get_close_matches(query, product_names, n=20, cutoff=0.6)
        for name in fuzzy_names:
            p = next(prod for prod in products if prod.name == name)
            matches.append({
                "product_id": p.id,
                "name": p.name,
                "category": cats.get(p.category_id, ""),
                "fuzzy_match": True,
            })

    return {"matches": matches[:20]}


def _muted_vendor_ids(db: Session) -> set[int]:
    return {v.id for v in db.query(Vendor).filter(Vendor.is_muted == True).all()}


def _assemble_order_payload(items: list, db: Session) -> dict:
    all_vendors = db.query(Vendor).filter(Vendor.is_deleted == False).all()
    vendor_map = {v.id: v.name for v in all_vendors}
    muted_ids = _muted_vendor_ids(db)

    vendor_assignments: dict[int, list] = {}
    vendor_hypothetical: dict[int, list] = {v.id: [] for v in all_vendors}
    unpriced_items = []

    for item in items:
        product_id = int(item["product_id"])
        quantity = float(item["quantity"])

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            unpriced_items.append({"product_id": product_id, "product_name": f"Unknown #{product_id}"})
            continue

        latest_sub = (
            db.query(
                Price.vendor_id,
                func.max(Price.updated_at).label("max_date"),
            )
            .filter(Price.product_id == product_id)
            .group_by(Price.vendor_id)
            .subquery()
        )
        prices = (
            db.query(Price)
            .join(
                latest_sub,
                (Price.vendor_id == latest_sub.c.vendor_id)
                & (Price.updated_at == latest_sub.c.max_date)
                & (Price.product_id == product_id),
            )
            .all()
        )

        active_prices = [p for p in prices if p.vendor_id not in muted_ids]
        if not active_prices:
            unpriced_items.append({"product_id": product_id, "product_name": product.name})
            continue

        for p in active_prices:
            vendor_hypothetical[p.vendor_id].append(round(p.price * quantity, 2))

        par_setting = (
            db.query(ParSetting)
            .filter(ParSetting.product_id == product_id, ParSetting.location_id == 1)
            .first()
        )
        selected = None
        if par_setting and par_setting.locked_vendor_id and par_setting.locked_vendor_id not in muted_ids:
            locked_price = next((p for p in active_prices if p.vendor_id == par_setting.locked_vendor_id), None)
            if locked_price:
                selected = locked_price
        if selected is None:
            selected = min(active_prices, key=lambda p: p.price)

        line_total = round(selected.price * quantity, 2)
        line_item = {
            "product_id": product_id,
            "product_name": product.name,
            "quantity": quantity,
            "unit_price": selected.price,
            "unit": selected.unit,
            "line_total": line_total,
            "selected_vendor_id": selected.vendor_id,
        }
        vendor_assignments.setdefault(selected.vendor_id, []).append(line_item)

    vendor_orders = []
    for vid, v_items in vendor_assignments.items():
        subtotal = round(sum(li["line_total"] for li in v_items), 2)
        vendor_orders.append({
            "vendor_id": vid,
            "vendor_name": vendor_map.get(vid, f"Vendor #{vid}"),
            "items": v_items,
            "subtotal": subtotal,
        })

    total_cost = round(sum(vo["subtotal"] for vo in vendor_orders), 2)
    valid_totals = [round(sum(h), 2) for h in vendor_hypothetical.values() if h]
    savings_vs_worst = round(max(valid_totals) - total_cost, 2) if valid_totals else 0.0

    return {
        "vendor_orders": vendor_orders,
        "total_cost": total_cost,
        "savings_vs_worst": savings_vs_worst,
        "unpriced_items": unpriced_items,
        "assembled": True,
    }


def _draft_item_count(payload: dict) -> int:
    return sum(len(vo.get("items", [])) for vo in payload.get("vendor_orders", []))


def _tool_assemble_order(items: list, db: Session) -> dict:
    payload = _assemble_order_payload(items, db)
    draft_id = uuid.uuid4().hex
    draft = OrderDraft(
        id=draft_id,
        location_id=1,
        payload_json=json.dumps(payload),
        total_cost=payload["total_cost"],
        savings_vs_worst=payload["savings_vs_worst"],
        item_count=_draft_item_count(payload),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(draft)
    db.commit()
    payload["draft_id"] = draft_id
    return payload


def _confirmation_receipt(order: Order, item_count: int) -> dict:
    return {
        "order_id": int(order.id),
        "status": order.status,
        "review_status": order.review_status,
        "created_at": order.created_at.isoformat() if order.created_at else datetime.now(timezone.utc).isoformat(),
        "total_cost": float(order.total_cost),
        "savings_vs_worst": float(order.savings_vs_worst),
        "item_count": int(item_count),
        "vendor_splits": [
            {"vendor": split.vendor.name if split.vendor else f"Vendor #{split.vendor_id}", "total": float(split.total)}
            for split in order.vendor_splits
        ],
    }


def _readback_confirmation(order_id: int, expected_total: float, expected_item_count: int, db: Session) -> dict | None:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None
    item_count = db.query(func.count(OrderItem.id)).filter(OrderItem.order_id == order.id).scalar() or 0
    if round(float(order.total_cost), 2) != round(float(expected_total), 2):
        return None
    if int(item_count) != int(expected_item_count):
        return None
    return _confirmation_receipt(order, int(item_count))


def _tool_save_order(draft_id: str, origin_route: str, db: Session) -> dict:
    draft = db.query(OrderDraft).filter(OrderDraft.id == draft_id).first()
    now = datetime.now(timezone.utc)
    if not draft:
        return {"status": "not_saved", "error": "Draft not found. Please assemble the order again."}
    expires_at = draft.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if draft.consumed_at is not None:
        return {"status": "not_saved", "error": "This draft was already saved. No duplicate order was created."}
    if expires_at and expires_at < now:
        return {"status": "not_saved", "error": "This draft expired. Please assemble the order again."}

    assembled = json.loads(draft.payload_json)
    expected_item_count = int(draft.item_count)
    order = Order(
        location_id=draft.location_id,
        total_cost=draft.total_cost,
        savings_vs_worst=draft.savings_vs_worst,
        status="saved",
        requires_review=True,
        review_status="pending",
        taco_flag_count=0,
        comparison_json=json.dumps({"source": "chat_draft", "draft_id": draft.id}),
        origin_route=origin_route or "chat",
        employee_name=None,
    )
    db.add(order)
    db.flush()
    for vo in assembled.get("vendor_orders", []):
        for li in vo.get("items", []):
            db.add(OrderItem(
                order_id=order.id,
                product_id=li["product_id"],
                quantity=int(float(li["quantity"])),
                selected_vendor_id=li["selected_vendor_id"],
                unit_price=li["unit_price"],
                line_total=li["line_total"],
            ))
        db.add(OrderVendorSplit(order_id=order.id, vendor_id=vo["vendor_id"], total=vo["subtotal"]))
    db.flush()
    draft.consumed_at = now
    draft.consumed_order_id = order.id

    receipt = _readback_confirmation(order.id, draft.total_cost, expected_item_count, db)
    if not receipt:
        db.rollback()
        return {"status": "not_saved", "error": "Order write could not be verified. No order was saved. Please retry."}
    db.commit()
    return {"status": "saved", "confirmation_receipt": receipt}


def _tool_get_par_order(db: Session) -> dict:
    par_settings = (
        db.query(ParSetting)
        .filter(ParSetting.location_id == 1, ParSetting.par_value > 0)
        .all()
    )
    reorder_list = []
    for ps in par_settings:
        product = db.query(Product).filter(Product.id == ps.product_id).first()
        if not product or product.muted or product.is_deleted:
            continue
        locked_vendor_name = None
        if ps.locked_vendor_id:
            v = db.query(Vendor).filter(Vendor.id == ps.locked_vendor_id).first()
            if v:
                locked_vendor_name = v.name
        reorder_list.append({
            "product_id": ps.product_id,
            "name": product.name,
            "par_value": ps.par_value,
            "locked_vendor": locked_vendor_name,
        })
    return {"par_items": reorder_list}


def _tool_get_vendors(db: Session) -> dict:
    vendors = db.query(Vendor).filter(Vendor.is_deleted == False).all()
    return {
        "vendors": [
            {"vendor_id": v.id, "name": v.name, "is_muted": v.is_muted}
            for v in vendors
        ]
    }


def _tool_get_categories(db: Session) -> dict:
    cats = db.query(Category).order_by(Category.sort_order, Category.name).all()
    return {"categories": [{"category_id": c.id, "name": c.name} for c in cats]}


def _tool_lock_vendor(product_id: int, vendor_id: int, db: Session) -> dict:
    ps = db.query(ParSetting).filter(
        ParSetting.product_id == product_id, ParSetting.location_id == 1
    ).first()
    if ps:
        ps.locked_vendor_id = vendor_id
    else:
        db.add(ParSetting(product_id=product_id, location_id=1, par_value=0, locked_vendor_id=vendor_id))
    db.commit()
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    product = db.query(Product).filter(Product.id == product_id).first()
    return {
        "locked": True,
        "product": product.name if product else f"#{product_id}",
        "vendor": vendor.name if vendor else f"#{vendor_id}",
    }


def _tool_unlock_vendor(product_id: int, db: Session) -> dict:
    ps = db.query(ParSetting).filter(
        ParSetting.product_id == product_id, ParSetting.location_id == 1
    ).first()
    if ps:
        ps.locked_vendor_id = None
        db.commit()
    product = db.query(Product).filter(Product.id == product_id).first()
    return {"unlocked": True, "product": product.name if product else f"#{product_id}"}


def _tool_set_par_value(product_id: int, par_value: float, db: Session) -> dict:
    ps = db.query(ParSetting).filter(
        ParSetting.product_id == product_id, ParSetting.location_id == 1
    ).first()
    if ps:
        ps.par_value = int(par_value)
    else:
        db.add(ParSetting(product_id=product_id, location_id=1, par_value=int(par_value)))
    db.commit()
    product = db.query(Product).filter(Product.id == product_id).first()
    return {"set": True, "product": product.name if product else f"#{product_id}", "par_value": int(par_value)}


def _tool_mute_vendor(vendor_id: int, db: Session) -> dict:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        return {"error": f"Vendor {vendor_id} not found"}
    vendor.is_muted = True
    db.commit()
    return {"muted": True, "vendor": vendor.name}


def _tool_unmute_vendor(vendor_id: int, db: Session) -> dict:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        return {"error": f"Vendor {vendor_id} not found"}
    vendor.is_muted = False
    db.commit()
    return {"unmuted": True, "vendor": vendor.name}


def _tool_set_price(product_id: int, vendor_id: int, price: float, unit: str | None, db: Session) -> dict:
    # Get existing price to log old value
    existing = db.query(Price).filter(
        Price.product_id == product_id, Price.vendor_id == vendor_id
    ).order_by(Price.updated_at.desc()).first()
    old_price = existing.price if existing else None

    if existing:
        existing.price = price
        existing.updated_at = datetime.now(timezone.utc)
        existing.is_manual = True
        if unit:
            existing.unit = unit
    else:
        db.add(Price(
            product_id=product_id,
            vendor_id=vendor_id,
            price=price,
            unit=unit or "each",
            is_manual=True,
        ))

    # Audit log
    db.add(AuditLog(
        vendor_id=vendor_id,
        product_id=product_id,
        old_price=old_price,
        new_price=price,
        source="chat",
    ))
    db.commit()

    product = db.query(Product).filter(Product.id == product_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    return {
        "set": True,
        "product": product.name if product else f"#{product_id}",
        "vendor": vendor.name if vendor else f"#{vendor_id}",
        "price": price,
    }


def _tool_get_order_history(period: str, db: Session) -> dict:
    cutoff = _period_cutoff(period or "month")
    q = db.query(Order).filter(Order.status == "saved")
    if cutoff:
        q = q.filter(Order.created_at >= cutoff)
    orders = q.order_by(Order.created_at.desc()).limit(50).all()

    result = []
    for o in orders:
        splits = db.query(OrderVendorSplit).filter(OrderVendorSplit.order_id == o.id).all()
        vendor_names = []
        for s in splits:
            v = db.query(Vendor).filter(Vendor.id == s.vendor_id).first()
            if v:
                vendor_names.append(v.name)
        result.append({
            "order_id": o.id,
            "date": o.created_at.strftime("%Y-%m-%d") if o.created_at else None,
            "total_cost": o.total_cost,
            "savings_vs_worst": o.savings_vs_worst,
            "review_status": o.review_status,
            "vendors": vendor_names,
        })
    return {"orders": result, "period": period or "month"}


def _tool_get_spend_summary(period: str, db: Session) -> dict:
    cutoff = _period_cutoff(period or "month")
    q = db.query(Order).filter(Order.status == "saved")
    if cutoff:
        q = q.filter(Order.created_at >= cutoff)
    orders = q.all()
    total_spent = round(sum(o.total_cost or 0 for o in orders), 2)
    total_saved = round(sum(o.savings_vs_worst or 0 for o in orders), 2)
    return {
        "period": period or "month",
        "order_count": len(orders),
        "total_spent": total_spent,
        "total_saved": total_saved,
    }


def _tool_note_synonym(alias: str, canonical: str, db: Session) -> dict:
    existing = db.query(Synonym).filter(
        func.lower(Synonym.alias) == alias.lower(),
        Synonym.location_id == 1,
    ).first()
    if existing:
        existing.canonical = canonical
    else:
        db.add(Synonym(alias=alias.lower(), canonical=canonical, location_id=1))
    db.commit()
    return {"recorded": True, "alias": alias, "canonical": canonical}


def _tool_flag_item(order_id: int, product_id: int, note: str, db: Session) -> dict:
    item = db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.product_id == product_id,
    ).first()
    if not item:
        return {"error": f"Item product_id={product_id} not found in order {order_id}"}
    item.flag = note
    # Recount flags on the order
    order = db.query(Order).filter(Order.id == order_id).first()
    if order:
        flag_count = db.query(OrderItem).filter(
            OrderItem.order_id == order_id,
            OrderItem.flag != None,
            OrderItem.flag != "",
        ).count()
        # +1 for the item we just set (not yet committed)
        if not item.flag:
            flag_count += 1
        order.taco_flag_count = flag_count
    db.commit()
    product = db.query(Product).filter(Product.id == product_id).first()
    return {"flagged": True, "product": product.name if product else f"#{product_id}", "note": note}


def _tool_add_order_note(order_id: int, note: str, db: Session) -> dict:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"error": f"Order {order_id} not found"}
    order.notes_to_john = note
    db.commit()
    return {"noted": True, "order_id": order_id}


def _tool_add_product(name: str, category_id: int, unit: str | None, db: Session) -> dict:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        return {"error": f"Category {category_id} not found — use get_categories to list valid IDs"}
    product = Product(name=name, category_id=category_id, unit=unit or "each")
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"added": True, "product_id": product.id, "name": name, "category": category.name}


def _tool_mute_product(product_id: int, db: Session) -> dict:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"error": f"Product {product_id} not found"}
    product.muted = True
    db.commit()
    return {"muted": True, "product": product.name}


def _tool_unmute_product(product_id: int, db: Session) -> dict:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"error": f"Product {product_id} not found"}
    product.muted = False
    db.commit()
    return {"unmuted": True, "product": product.name}


def _tool_review_order(order_id: int, action: str, note: str | None, db: Session) -> dict:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"error": f"Order {order_id} not found"}
    if order.review_status != "pending":
        return {"error": f"Order {order_id} is not pending (status: {order.review_status})"}
    order.review_status = "approved" if action == "approve" else "rejected"
    if note:
        order.review_note = note
    db.commit()
    return {"order_id": order_id, "review_status": order.review_status}


def _tool_dismiss_order(order_id: int, note: str | None, db: Session) -> dict:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"error": f"Order {order_id} not found"}
    order.review_status = "dismissed"
    if note:
        order.review_note = note
    db.commit()
    return {"dismissed": True, "order_id": order_id}


def _tool_delete_order(order_id: int, db: Session) -> dict:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"error": f"Order {order_id} not found"}
    if order.review_status != "pending":
        return {"error": f"Order {order_id} cannot be deleted — status is '{order.review_status}'. Only pending orders can be deleted."}
    db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
    db.query(OrderVendorSplit).filter(OrderVendorSplit.order_id == order_id).delete()
    db.delete(order)
    db.commit()
    return {"deleted": True, "order_id": order_id}


def _tool_edit_order(order_id: int, items: list | None, notes_to_john: str | None, db: Session) -> dict:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"error": f"Order {order_id} not found"}
    if order.review_status != "pending":
        return {"error": f"Order {order_id} cannot be edited — status is '{order.review_status}'"}

    if items:
        db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
        db.query(OrderVendorSplit).filter(OrderVendorSplit.order_id == order_id).delete()
        assembled = _tool_assemble_order(items, db)
        for vo in assembled["vendor_orders"]:
            for li in vo["items"]:
                db.add(OrderItem(
                    order_id=order_id,
                    product_id=li["product_id"],
                    quantity=li["quantity"],
                    selected_vendor_id=li["selected_vendor_id"],
                    unit_price=li["unit_price"],
                    line_total=li["line_total"],
                ))
            db.add(OrderVendorSplit(order_id=order_id, vendor_id=vo["vendor_id"], total=vo["subtotal"]))
        order.total_cost = assembled["total_cost"]
        order.savings_vs_worst = assembled["savings_vs_worst"]

    if notes_to_john is not None:
        order.notes_to_john = notes_to_john

    db.commit()
    return {"updated": True, "order_id": order_id, "total_cost": order.total_cost}


def _tool_get_pending_orders(db: Session) -> dict:
    orders = (
        db.query(Order)
        .filter(Order.review_status == "pending")
        .order_by(Order.created_at.desc())
        .all()
    )
    result = []
    for o in orders:
        items = db.query(OrderItem).filter(OrderItem.order_id == o.id).all()
        splits = db.query(OrderVendorSplit).filter(OrderVendorSplit.order_id == o.id).all()
        vendor_splits = []
        for s in splits:
            v = db.query(Vendor).filter(Vendor.id == s.vendor_id).first()
            vendor_splits.append({"vendor": v.name if v else f"#{s.vendor_id}", "total": s.total})
        result.append({
            "order_id": o.id,
            "date": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else None,
            "total_cost": o.total_cost,
            "item_count": len(items),
            "taco_flag_count": o.taco_flag_count,
            "vendor_splits": vendor_splits,
            "notes_to_john": o.notes_to_john,
        })
    return {"pending_orders": result}


def _tool_get_price_pending(db: Session) -> dict:
    active_vendor_ids = {
        v.id for v in db.query(Vendor).filter(Vendor.is_deleted == False, Vendor.is_muted == False).all()
    }
    all_products = db.query(Product).filter(Product.muted == False, Product.is_deleted == False).all()

    unpriced = []
    for p in all_products:
        priced_vendor_ids = {
            pr.vendor_id for pr in db.query(Price).filter(Price.product_id == p.id).all()
        }
        if not priced_vendor_ids.intersection(active_vendor_ids):
            unpriced.append({"product_id": p.id, "name": p.name})

    return {"unpriced_products": unpriced, "count": len(unpriced)}


def _tool_get_price_audit_log(limit: int, db: Session) -> dict:
    entries = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit or 20)
        .all()
    )
    result = []
    for e in entries:
        product = db.query(Product).filter(Product.id == e.product_id).first()
        vendor = db.query(Vendor).filter(Vendor.id == e.vendor_id).first()
        result.append({
            "timestamp": e.timestamp.strftime("%Y-%m-%d %H:%M") if e.timestamp else None,
            "product": product.name if product else f"#{e.product_id}",
            "vendor": vendor.name if vendor else f"#{e.vendor_id}",
            "old_price": e.old_price,
            "new_price": e.new_price,
            "source": e.source,
        })
    return {"audit_log": result}


def _tool_get_synonyms(db: Session) -> dict:
    synonyms = db.query(Synonym).filter(Synonym.location_id == 1).order_by(Synonym.alias).all()
    return {
        "synonyms": [{"alias": s.alias, "canonical": s.canonical} for s in synonyms],
        "count": len(synonyms),
    }


# ── Tool dispatcher ───────────────────────────────────────────────────────────

def execute_tool(tool_name: str, tool_input: dict, db: Session) -> Any:
    if tool_name == "search_products":
        return _tool_search_products(tool_input["query"], db)
    elif tool_name == "assemble_order":
        return _tool_assemble_order(tool_input["items"], db)
    elif tool_name == "save_order":
        return _tool_save_order(tool_input["draft_id"], tool_input.get("origin_route", "chat"), db)
    elif tool_name == "get_par_order":
        return _tool_get_par_order(db)
    elif tool_name == "get_vendors":
        return _tool_get_vendors(db)
    elif tool_name == "get_categories":
        return _tool_get_categories(db)
    elif tool_name == "lock_vendor":
        return _tool_lock_vendor(tool_input["product_id"], tool_input["vendor_id"], db)
    elif tool_name == "unlock_vendor":
        return _tool_unlock_vendor(tool_input["product_id"], db)
    elif tool_name == "set_par_value":
        return _tool_set_par_value(tool_input["product_id"], tool_input["par_value"], db)
    elif tool_name == "mute_vendor":
        return _tool_mute_vendor(tool_input["vendor_id"], db)
    elif tool_name == "unmute_vendor":
        return _tool_unmute_vendor(tool_input["vendor_id"], db)
    elif tool_name == "set_price":
        return _tool_set_price(
            tool_input["product_id"], tool_input["vendor_id"],
            tool_input["price"], tool_input.get("unit"), db,
        )
    elif tool_name == "get_order_history":
        return _tool_get_order_history(tool_input.get("period", "month"), db)
    elif tool_name == "get_spend_summary":
        return _tool_get_spend_summary(tool_input.get("period", "month"), db)
    elif tool_name == "note_synonym":
        return _tool_note_synonym(tool_input["alias"], tool_input["canonical"], db)
    elif tool_name == "flag_item":
        return _tool_flag_item(tool_input["order_id"], tool_input["product_id"], tool_input["note"], db)
    elif tool_name == "add_order_note":
        return _tool_add_order_note(tool_input["order_id"], tool_input["note"], db)
    elif tool_name == "add_product":
        return _tool_add_product(tool_input["name"], tool_input["category_id"], tool_input.get("unit"), db)
    elif tool_name == "mute_product":
        return _tool_mute_product(tool_input["product_id"], db)
    elif tool_name == "unmute_product":
        return _tool_unmute_product(tool_input["product_id"], db)
    elif tool_name == "review_order":
        return _tool_review_order(tool_input["order_id"], tool_input["action"], tool_input.get("note"), db)
    elif tool_name == "dismiss_order":
        return _tool_dismiss_order(tool_input["order_id"], tool_input.get("note"), db)
    elif tool_name == "delete_order":
        return _tool_delete_order(tool_input["order_id"], db)
    elif tool_name == "edit_order":
        return _tool_edit_order(
            tool_input["order_id"],
            tool_input.get("items"),
            tool_input.get("notes_to_john"),
            db,
        )
    elif tool_name == "get_pending_orders":
        return _tool_get_pending_orders(db)
    elif tool_name == "get_price_pending":
        return _tool_get_price_pending(db)
    elif tool_name == "get_price_audit_log":
        return _tool_get_price_audit_log(tool_input.get("limit", 20), db)
    elif tool_name == "get_synonyms":
        return _tool_get_synonyms(db)
    else:
        return {"error": f"Unknown tool: {tool_name}"}


# ── Chat endpoint ─────────────────────────────────────────────────────────────

@router.post("")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # SingleMindedAgent: inject full catalog on every turn so Taquito always has
    # complete product IDs regardless of conversation length. Muted items are
    # included with a [MUTED] tag so unmute_product works correctly.
    catalog = _get_catalog_context(db)
    if catalog:
        messages.append({"role": "system", "content": catalog})

    # Session context (pending orders, last order) — first turn only, nice-to-have
    if len(request.messages) == 1:
        ctx = _get_session_context(db)
        if ctx:
            messages.append({"role": "system", "content": ctx})

    draft_id = _latest_draft_id(request)
    if draft_id:
        messages.append({"role": "system", "content": f"Current assembled order draft_id: {draft_id}. If John confirms/saves this order, call save_order with exactly this draft_id."})

    messages += [{"role": m.role, "content": m.content} for m in request.messages]

    order_data = None
    confirmation_receipt = None
    save_unverified_error = None
    max_iterations = 10
    for _ in range(max_iterations):
        active_tools = select_tools(messages)
        response = client.chat.completions.create(
            model=MODEL,
            tools=active_tools,
            messages=messages,
            temperature=TAQUITO_TEMPERATURE,
            top_p=TAQUITO_TOP_P,
            extra_body={"options": {"top_k": TAQUITO_TOP_K, "repeat_penalty": TAQUITO_REPEAT_PENALTY}},
        )

        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        if finish_reason == "tool_calls":
            assembled_order = None
            messages.append({
                "role": message.role,
                "content": message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in message.tool_calls
                ] if message.tool_calls else [],
            })
            for tc in message.tool_calls:
                tool_input = json.loads(tc.function.arguments)
                result = execute_tool(tc.function.name, tool_input, db)
                if tc.function.name == "assemble_order":
                    assembled_order = result
                if tc.function.name == "save_order" and result.get("confirmation_receipt"):
                    confirmation_receipt = result["confirmation_receipt"]
                    save_unverified_error = None
                elif tc.function.name == "save_order" and result.get("status") == "not_saved":
                    save_unverified_error = result.get("error") or "The order could not be verified as saved. Please try again."
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result),
                })
            if assembled_order:
                order_data = assembled_order

        elif finish_reason == "stop":
            reply_text = message.content or ""
            latest_user_message = ""
            for request_message in reversed(request.messages):
                if request_message.role == "user":
                    latest_user_message = request_message.content
                    break

            if confirmation_receipt:
                reply_text = "Order saved. It's in the review queue."
            elif save_unverified_error:
                reply_text = save_unverified_error
            elif (
                order_data is None
                and confirmation_receipt is None
                and (
                    _looks_like_order_request(latest_user_message)
                    or _looks_like_save_confirmation(latest_user_message)
                )
            ):
                reply_text = _safe_no_draft_reply()

            # T7 — persist conversation turn
            try:
                if request.messages:
                    user_msg = request.messages[-1]
                    if user_msg.role == "user":
                        db.add(ChatMessageModel(role="user", content=user_msg.content, location_id=1))
                db.add(ChatMessageModel(role="assistant", content=reply_text, location_id=1))
                db.commit()
            except Exception:
                db.rollback()

            return {"reply": reply_text, "order_data": order_data, "confirmation_receipt": confirmation_receipt}

        else:
            break

    return {"reply": "I'm having trouble processing that. Please try again.", "order_data": None, "confirmation_receipt": None}
