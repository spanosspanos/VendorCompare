from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from ..database import get_db
from ..models import Price, Product, Vendor
from ..schemas import PriceOut

router = APIRouter()


def _latest_prices_query(db: Session, product_id: Optional[int] = None):
    """Get the latest price per product/vendor pair."""
    # Subquery: max updated_at per product_id/vendor_id
    latest_sub = (
        db.query(
            Price.product_id,
            Price.vendor_id,
            func.max(Price.updated_at).label("max_date"),
        )
        .group_by(Price.product_id, Price.vendor_id)
        .subquery()
    )

    query = (
        db.query(Price, Product.name.label("product_name"), Vendor.name.label("vendor_name"))
        .join(Product, Price.product_id == Product.id)
        .join(Vendor, Price.vendor_id == Vendor.id)
        .join(
            latest_sub,
            (Price.product_id == latest_sub.c.product_id)
            & (Price.vendor_id == latest_sub.c.vendor_id)
            & (Price.updated_at == latest_sub.c.max_date),
        )
    )

    if product_id is not None:
        query = query.filter(Price.product_id == product_id)

    return query.all()


@router.get("", response_model=list[PriceOut])
def get_prices(
    product_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    results = _latest_prices_query(db, product_id)
    return [
        PriceOut(
            id=price.id,
            product_id=price.product_id,
            product_name=product_name,
            vendor_id=price.vendor_id,
            vendor_name=vendor_name,
            unit_price=price.price,
            unit=price.unit,
            effective_date=price.updated_at,
        )
        for price, product_name, vendor_name in results
    ]


@router.get("/product/{product_id}", response_model=list[PriceOut])
def get_product_prices(
    product_id: int,
    db: Session = Depends(get_db),
):
    results = _latest_prices_query(db, product_id)
    return [
        PriceOut(
            id=price.id,
            product_id=price.product_id,
            product_name=product_name,
            vendor_id=price.vendor_id,
            vendor_name=vendor_name,
            unit_price=price.price,
            unit=price.unit,
            effective_date=price.updated_at,
        )
        for price, product_name, vendor_name in results
    ]
