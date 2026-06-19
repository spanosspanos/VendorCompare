import json
import httpx
import tempfile
from mcp.server.fastmcp import FastMCP

BASE = "http://127.0.0.1:8000/api"
mcp = FastMCP("VendorCompare")


# ────────────────────────────────────────────────────────────────────────────
# PHASE 1: QuickOrder (6 tools) — rewritten cleanly, behavior unchanged
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def list_categories() -> list:
    """List all product categories available in VendorCompare."""
    return httpx.get(f"{BASE}/categories").json()


@mcp.tool()
def search_products(query: str, category_id: int = None) -> list:
    """Search products by name.
    Returns list of products with product_id, name, category, and unit."""
    params = {"search": query}
    if category_id:
        params["category_id"] = category_id
    return httpx.get(f"{BASE}/products", params=params).json()


@mcp.tool()
def assemble_order(items: list) -> dict:
    """Preview order split by vendor before saving.
    items: list of {"product_id": int, "quantity": int}
    Returns vendor breakdown, total_cost, and savings_vs_worst."""
    payload = {"location_id": 1, "items": items}
    return httpx.post(f"{BASE}/orders/assemble", json=payload).json()


@mcp.tool()
def save_order(assembled: dict) -> dict:
    """Save order for review and approval.
    Pass the full dict returned by assemble_order.
    Always requires review before PO is generated."""
    vendor_splits = [
        {"vendor_id": vo["vendor_id"], "total": vo["subtotal"]}
        for vo in assembled["vendor_orders"]
    ]
    items = [
        {
            "product_id": item["product_id"],
            "quantity": item["quantity"],
            "selected_vendor_id": vo["vendor_id"],
            "unit_price": item["unit_price"],
            "line_total": item["line_total"],
        }
        for vo in assembled["vendor_orders"]
        for item in vo["items"]
    ]
    comparison = assembled.get("comparison")
    savings = comparison["savings_vs_worst"] if comparison else 0.0

    payload = {
        "location_id": 1,
        "total_cost": assembled["total_cost"],
        "savings_vs_worst": savings,
        "items": items,
        "vendor_splits": vendor_splits,
        "requires_review": True,
        "origin_route": "mcp",
        "comparison": comparison,
        "taco_flag_count": 0,
    }
    return httpx.post(f"{BASE}/orders", json=payload).json()


@mcp.tool()
def get_pending_orders() -> list:
    """Get all orders waiting for John's review in VendorCompare."""
    return httpx.get(f"{BASE}/orders/pending-review").json()


@mcp.tool()
def get_order_status(order_id: int) -> dict:
    """Get status and detail of a specific order by ID."""
    return httpx.get(f"{BASE}/orders/{order_id}").json()


# ────────────────────────────────────────────────────────────────────────────
# PHASE 2: New Ordering Tools (7 tools)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def list_orders(period: str = "all") -> list:
    """List order history.
    period: 'all' (default), 'week', 'month', 'quarter', 'year'.
    Returns list with id, total_cost, status, created_at, review_status."""
    params = {}
    if period and period != "all":
        params["period"] = period
    return httpx.get(f"{BASE}/orders", params=params).json()


@mcp.tool()
def get_spend_summary(period: str = "all") -> dict:
    """Get spend summary for a time period.
    period: 'all' (default), 'week', 'month', 'quarter', 'year'.
    Returns total_spent, total_saved, order_count."""
    params = {}
    if period and period != "all":
        params["period"] = period
    return httpx.get(f"{BASE}/orders/summary", params=params).json()


@mcp.tool()
def review_order(order_id: int, status: str, note: str = None) -> dict:
    """Update an order's review status.
    status: valid values are 'pending', 'approved', 'rejected', 'not_required'.
    note: optional review note.
    Returns updated order details."""
    payload = {"review_status": status}
    if note is not None:
        payload["review_note"] = note
    return httpx.post(f"{BASE}/orders/{order_id}/review", json=payload).json()


@mcp.tool()
def commit_order_edit(order_id: int, assembled: dict) -> dict:
    """Commit changes to an existing order.
    assembled: dict from assemble_order with updated items and vendor_splits.
    Used after user confirms a change."""
    vendor_splits = [
        {"vendor_id": vo["vendor_id"], "total": vo["subtotal"]}
        for vo in assembled["vendor_orders"]
    ]
    items = [
        {
            "product_id": item["product_id"],
            "quantity": item["quantity"],
            "selected_vendor_id": vo["vendor_id"],
            "unit_price": item["unit_price"],
            "line_total": item["line_total"],
        }
        for vo in assembled["vendor_orders"]
        for item in vo["items"]
    ]
    comparison = assembled.get("comparison")
    savings = comparison["savings_vs_worst"] if comparison else 0.0

    payload = {
        "location_id": 1,
        "total_cost": assembled["total_cost"],
        "savings_vs_worst": savings,
        "items": items,
        "vendor_splits": vendor_splits,
    }
    return httpx.patch(f"{BASE}/orders/{order_id}", json=payload).json()


@mcp.tool()
def delete_order(order_id: int) -> dict:
    """Delete a pending order. Only works on pending/not_required orders."""
    return httpx.delete(f"{BASE}/orders/{order_id}").json()


# ────────────────────────────────────────────────────────────────────────────
# PHASE 2: Vendors & Prices (3 tools)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def get_vendors() -> list:
    """Get list of all vendors with id and name."""
    return httpx.get(f"{BASE}/vendors").json()


@mcp.tool()
def get_product_prices(product_id: int) -> list:
    """Get all vendor prices for a single product."""
    return httpx.get(f"{BASE}/prices/product/{product_id}").json()


@mcp.tool()
def update_price(product_id: int, vendor_id: int, price: float, unit: str = None) -> dict:
    """Update price for a product from a vendor.
    Creates new price record (keeps history).
    Returns updated price record."""
    payload = {"price": price}
    if unit is not None:
        payload["unit"] = unit
    return httpx.put(
        f"{BASE}/prices/product/{product_id}/vendor/{vendor_id}",
        json=payload
    ).json()


# ────────────────────────────────────────────────────────────────────────────
# PHASE 2: PAR & Vendor Lock (3 tools)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def get_par_settings() -> list:
    """Get full PAR view: all products with prices per vendor + PAR values + vendor locks.
    Returns list of products enriched with pricing and PAR settings."""
    return httpx.get(f"{BASE}/par-settings/with-prices").json()


@mcp.tool()
def set_par_value(product_id: int, quantity: int) -> dict:
    """Set PAR value (stocking level) for a product.
    quantity: integer units for target PAR level.
    Returns updated PAR setting."""
    payload = {"par_value": quantity, "location_id": 1}
    return httpx.put(f"{BASE}/par-settings/{product_id}", json=payload).json()


@mcp.tool()
def set_vendor_lock(product_id: int, vendor_id: int = None) -> dict:
    """Lock a product to a specific vendor or clear the lock.
    vendor_id: vendor to lock to, or None to clear the lock.
    Returns updated PAR setting."""
    payload = {"locked_vendor_id": vendor_id, "location_id": 1}
    return httpx.patch(
        f"{BASE}/par-settings/{product_id}/vendor-lock",
        json=payload
    ).json()


# ────────────────────────────────────────────────────────────────────────────
# PHASE 2: Vendor Price Sheets (2 tools)
# ────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def upload_vendor_prices(vendor_id: int, csv_content: str) -> dict:
    """Upload and preview vendor price sheet (CSV).
    csv_content: raw CSV text string.
    Returns matched items with old/new price diffs for HITL confirmation.
    Note: must be confirmed with confirm_vendor_prices before changes apply."""
    with tempfile.NamedTemporaryFile(
        mode='w',
        suffix='.csv',
        delete=False,
        encoding='utf-8'
    ) as f:
        f.write(csv_content)
        temp_path = f.name

    try:
        with open(temp_path, 'rb') as f:
            files = {'file': ('prices.csv', f, 'text/csv')}
            return httpx.post(
                f"{BASE}/vendor-docs/upload/{vendor_id}",
                files=files
            ).json()
    finally:
        import os
        try:
            os.unlink(temp_path)
        except:
            pass


@mcp.tool()
def confirm_vendor_prices(vendor_id: int, preview_id: str, filename: str, item_count: int) -> dict:
    """Confirm and commit vendor price updates.
    preview_id: returned from upload_vendor_prices.
    filename: original filename from upload.
    item_count: number of items to commit.
    Returns count of committed prices."""
    payload = {
        "preview_id": preview_id,
        "filename": filename,
        "item_count": item_count,
    }
    return httpx.post(
        f"{BASE}/vendor-docs/confirm/{vendor_id}",
        json=payload
    ).json()


if __name__ == "__main__":
    mcp.run()
