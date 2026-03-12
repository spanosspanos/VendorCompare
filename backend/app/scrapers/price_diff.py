"""
Shared diff engine: compare scraped/uploaded prices against DB prices.
Returns a list of PriceDiffItem dicts ready to display to John.
"""

from sqlalchemy.orm import Session
from ..models import Product, Price, Vendor


def compute_diff(scraped_items: list[dict], db: Session) -> dict:
    """
    Compare scraped/uploaded prices against current DB prices.

    scraped_items: list of {"product_id": int, "vendor_id": int, "new_price": float, "unit": str}
    Returns: {"diffs": [...], "unmatched": [...]}
    """
    diffs = []
    unmatched = []

    for item in scraped_items:
        product_id = item.get("product_id")
        vendor_id = item.get("vendor_id")
        new_price = item.get("new_price")
        unit = item.get("unit", "")
        raw_name = item.get("raw_name", "")

        if product_id is None:
            unmatched.append({"raw_name": raw_name, "new_price": new_price})
            continue

        product = db.query(Product).filter(Product.id == product_id).first()
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

        if product is None or vendor is None:
            unmatched.append({"raw_name": raw_name or f"product_id={product_id}", "new_price": new_price})
            continue

        # Find existing price record
        existing_price = (
            db.query(Price)
            .filter(Price.product_id == product_id, Price.vendor_id == vendor_id)
            .order_by(Price.updated_at.desc())
            .first()
        )
        old_price = existing_price.price if existing_price else None

        if old_price is not None and old_price > 0:
            change_pct = round((new_price - old_price) / old_price * 100, 2)
        else:
            change_pct = None

        diffs.append({
            "product_id": product_id,
            "product_name": product.name,
            "vendor_id": vendor_id,
            "vendor_name": vendor.name,
            "old_price": old_price,
            "new_price": new_price,
            "change_pct": change_pct,
            "unit": unit or (existing_price.unit if existing_price else product.unit),
        })

    return {"diffs": diffs, "unmatched": unmatched}
