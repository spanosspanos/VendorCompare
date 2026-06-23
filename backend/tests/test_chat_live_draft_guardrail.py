import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.database import Base
from app.models import Location
from app.routers import chat


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    session.add(Location(id=1, name="White Plains"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def _chat_response(message, db):
    request = chat.ChatRequest(messages=[chat.ChatMessage(role="user", content=message)])
    return asyncio.run(chat.chat(request=request, db=db, role="ordering"))


def _stub_completion(content, finish_reason="stop"):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(content=content, role="assistant", tool_calls=None),
            )
        ]
    )


def test_order_request_helper_catches_quantity_product_phrase():
    assert chat._looks_like_order_request("I need 2 limes") is True
    assert chat._looks_like_order_request("2 limes") is True
    assert chat._looks_like_order_request("add 3 cases tortillas") is True
    assert chat._looks_like_order_request("hello") is False


def test_save_confirmation_helper_catches_save_it():
    assert chat._looks_like_save_confirmation("save it") is True
    assert chat._looks_like_save_confirmation("looks good, save that") is True


def test_stop_without_draft_for_order_request_returns_safe_no_draft_response(db, monkeypatch):
    fabricated = "Sure — I saved 2 limes from Food Direct for $12.00."
    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion(fabricated),
    )

    payload = _chat_response("I need 2 limes and 3 avocados", db)
    assert payload["reply"] == chat._safe_no_draft_reply()
    assert payload["order_data"] is None
    assert payload["confirmation_receipt"] is None
    assert "saved 2 limes" not in payload["reply"]


def test_stop_without_draft_for_save_confirmation_returns_safe_no_draft_response(db, monkeypatch):
    fabricated = "Order saved. It's in the review queue."
    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion(fabricated),
    )

    payload = _chat_response("save it", db)
    assert payload["reply"] == chat._safe_no_draft_reply()
    assert payload["order_data"] is None
    assert payload["confirmation_receipt"] is None
    assert payload["reply"] != fabricated


def test_stop_without_draft_for_non_order_conversation_preserves_model_reply(db, monkeypatch):
    normal_reply = "I can help with VendorCompare ordering."
    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion(normal_reply),
    )

    payload = _chat_response("hello", db)

    assert payload["reply"] == normal_reply


def test_extract_order_item_basic():
    extracted = chat._extract_order_item("I need 2 limes")
    assert extracted is not None
    item_text, quantity = extracted
    assert "lime" in item_text.lower()
    assert quantity == 2.0


def test_extract_order_item_no_quantity():
    assert chat._extract_order_item("I need avocados") is None


def test_extract_order_item_multi_item():
    assert chat._extract_order_item("I need 2 limes and 3 avocados") is None


def test_quick_path_zero_matches(db, monkeypatch):
    extracted = chat._extract_order_item("I need 2 limes")
    assert extracted == ("limes", 2.0)
    search_result = chat._tool_search_products(extracted[0], db)
    assert search_result["matches"] == []

    def fail_if_called(**kwargs):
        raise AssertionError("model should not be called for zero-match quick path")

    monkeypatch.setattr(chat.client.chat.completions, "create", fail_if_called)

    payload = _chat_response("I need 2 limes", db)
    assert payload["reply"] == "I don't see that in the catalog. Try the exact product name, or ask me to search."
    assert payload["order_data"] is None
    assert payload["confirmation_receipt"] is None


def test_quick_path_single_match_sets_order_data(db, monkeypatch):
    from app.models import Category, Product, Vendor, Price

    db.add(Category(id=1, name="Produce", sort_order=1))
    db.add(Vendor(id=1, name="Food Direct", is_muted=False, is_deleted=False))
    db.add(Product(id=32, name="Limes", category_id=1, unit="case"))
    db.add(Price(product_id=32, vendor_id=1, price=10.0, unit="case"))
    db.commit()

    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion("I found limes and assembled a draft."),
    )

    payload = _chat_response("I need 2 limes", db)
    assert payload["order_data"] is not None
    assert payload["order_data"].get("draft_id")
    assert payload["confirmation_receipt"] is None


def test_quick_path_multi_match_no_auto_assemble(db, monkeypatch):
    from app.models import Category, Product, Vendor, Price

    db.add(Category(id=1, name="Dry Goods", sort_order=1))
    db.add(Vendor(id=1, name="Food Direct", is_muted=False, is_deleted=False))
    db.add(Product(id=10, name="5 Inch Flour Tortilla", category_id=1, unit="case"))
    db.add(Product(id=11, name="12 Inch Flour Tortilla", category_id=1, unit="case"))
    db.add(Price(product_id=10, vendor_id=1, price=20.0, unit="case"))
    db.add(Price(product_id=11, vendor_id=1, price=30.0, unit="case"))
    db.commit()

    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion("Which tortilla do you mean?"),
    )

    payload = _chat_response("I need 2 tortilla", db)
    assert payload["order_data"] is None
    assert payload["confirmation_receipt"] is None
