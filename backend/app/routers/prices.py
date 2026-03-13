from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timezone

from ..database import get_db
from ..models import Price, Product, Vendor
from ..schemas import PriceOut, PriceUpdateIn

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
            is_manual=price.is_manual,
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
            is_manual=price.is_manual,
        )
        for price, product_name, vendor_name in results
    ]


@router.put("/product/{product_id}/vendor/{vendor_id}", response_model=PriceOut)
def update_price(
    product_id: int,
    vendor_id: int,
    payload: PriceUpdateIn,
    db: Session = Depends(get_db),
):
    """Create a new Price record for product+vendor (keeps history). Returns PriceOut."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    new_price = Price(
        product_id=product_id,
        vendor_id=vendor_id,
        price=payload.price,
        unit=payload.unit,
        updated_at=datetime.now(timezone.utc),
        is_manual=True,  # Manual edit from PARManager — mark as user-set price
    )
    db.add(new_price)
    db.commit()
    db.refresh(new_price)

    return PriceOut(
        id=new_price.id,
        product_id=new_price.product_id,
        product_name=product.name,
        vendor_id=new_price.vendor_id,
        vendor_name=vendor.name,
        unit_price=new_price.price,
        unit=new_price.unit,
        effective_date=new_price.updated_at,
        is_manual=new_price.is_manual,
    )
