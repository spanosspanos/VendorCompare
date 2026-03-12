"""
Write confirmed diffs to DB with audit log.
"""

from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..models import Price, AuditLog


def import_confirmed_diffs(diffs: list[dict], vendor_id: int, db: Session) -> int:
    """
    Write confirmed price diffs to DB and create audit log entries.
    Returns count of records written.
    """
    count = 0
    for diff in diffs:
        product_id = diff["product_id"]
        new_price = diff["new_price"]
        unit = diff.get("unit", "")
        old_price = diff.get("old_price")
        source = diff.get("source", "upload")

        # Update or create Price record
        existing = (
            db.query(Price)
            .filter(Price.product_id == product_id, Price.vendor_id == vendor_id)
            .first()
        )
        if existing:
            existing.price = new_price
            if unit:
                existing.unit = unit
            existing.updated_at = datetime.now(timezone.utc)
        else:
            existing = Price(
                product_id=product_id,
                vendor_id=vendor_id,
                price=new_price,
                unit=unit,
                updated_at=datetime.now(timezone.utc),
            )
            db.add(existing)

        # Write audit log entry
        audit = AuditLog(
            timestamp=datetime.now(timezone.utc),
            vendor_id=vendor_id,
            product_id=product_id,
            old_price=old_price,
            new_price=new_price,
            source=source,
        )
        db.add(audit)
        count += 1

    db.commit()
    return count
