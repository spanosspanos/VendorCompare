from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone

from ..database import get_db
from ..models import ParSetting, Product, Price, Vendor
from ..schemas import ParSettingOut, ParSettingIn, ParSettingWithPricesOut, VendorPriceSummary, VendorLockIn

router = APIRouter()


@router.get("/with-prices", response_model=List[ParSettingWithPricesOut])
def list_par_settings_with_prices(location_id: int = 1, db: Session = Depends(get_db)):
    """Return all products enriched with price data and PAR settings."""
    # Get all products
    products = db.query(Product).all()

    # Get latest prices per product/vendor
    latest_sub = (
        db.query(
            Price.product_id,
            Price.vendor_id,
            func.max(Price.updated_at).label("max_date"),
        )
        .group_by(Price.product_id, Price.vendor_id)
        .subquery()
    )

    prices_q = (
        db.query(Price, Vendor.name.label("vendor_name"))
        .join(Vendor, Price.vendor_id == Vendor.id)
        .join(
            latest_sub,
            (Price.product_id == latest_sub.c.product_id)
            & (Price.vendor_id == latest_sub.c.vendor_id)
            & (Price.updated_at == latest_sub.c.max_date),
        )
        .all()
    )

    # Build price map: product_id -> list of (price, vendor_id, vendor_name, unit)
    price_map: dict = {}
    for price, vendor_name in prices_q:
        if price.product_id not in price_map:
            price_map[price.product_id] = []
        price_map[price.product_id].append({
            "vendor_id": price.vendor_id,
            "vendor_name": vendor_name,
            "price": price.price,
            "unit": price.unit,
            "is_manual": price.is_manual,
        })

    # Get PAR settings for location
    par_settings = db.query(ParSetting).filter(ParSetting.location_id == location_id).all()
    par_map = {ps.product_id: ps for ps in par_settings}

    results = []
    for product in products:
        vendor_prices = price_map.get(product.id, [])
        par = par_map.get(product.id)

        available_vendors = [
            VendorPriceSummary(vendor_id=vp["vendor_id"], vendor_name=vp["vendor_name"], price=vp["price"], is_manual=vp.get("is_manual", False))
            for vp in vendor_prices
        ]

        cheapest = None
        if vendor_prices:
            cheapest = min(vendor_prices, key=lambda x: x["price"])

        results.append(ParSettingWithPricesOut(
            product_id=product.id,
            product_name=product.name,
            category_id=product.category_id,
            par_value=par.par_value if par else None,
            locked_vendor_id=par.locked_vendor_id if par else None,
            cheapest_price=cheapest["price"] if cheapest else None,
            cheapest_vendor_id=cheapest["vendor_id"] if cheapest else None,
            cheapest_vendor_name=cheapest["vendor_name"] if cheapest else None,
            cheapest_is_manual=cheapest["is_manual"] if cheapest else False,
            unit=cheapest["unit"] if cheapest else None,
            available_vendors=available_vendors,
            muted=product.muted,
            is_deleted=product.is_deleted,
        ))

    return results


@router.get("/", response_model=list[ParSettingOut])
def list_par_settings(location_id: int = 1, db: Session = Depends(get_db)):
    """List all PAR settings for a location."""
    settings = db.query(ParSetting).filter(ParSetting.location_id == location_id).all()
    return settings


@router.put("/{product_id}", response_model=ParSettingOut)
def upsert_par_setting(
    product_id: int,
    payload: ParSettingIn,
    location_id: int = 1,
    db: Session = Depends(get_db),
):
    """Upsert PAR value for a product+location."""
    existing = (
        db.query(ParSetting)
        .filter(
            ParSetting.product_id == product_id,
            ParSetting.location_id == location_id,
        )
        .first()
    )
    if existing:
        existing.par_value = payload.par_value
        db.commit()
        db.refresh(existing)
        return existing
    else:
        setting = ParSetting(
            product_id=product_id,
            location_id=location_id,
            par_value=payload.par_value,
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting


@router.patch("/{product_id}/vendor-lock", response_model=ParSettingOut)
def set_vendor_lock(
    product_id: int,
    payload: VendorLockIn,
    location_id: int = 1,
    db: Session = Depends(get_db),
):
    """Set or clear vendor lock for a product+location."""
    existing = (
        db.query(ParSetting)
        .filter(
            ParSetting.product_id == product_id,
            ParSetting.location_id == location_id,
        )
        .first()
    )
    if existing:
        existing.locked_vendor_id = payload.locked_vendor_id
        db.commit()
        db.refresh(existing)
        return existing
    else:
        setting = ParSetting(
            product_id=product_id,
            location_id=location_id,
            par_value=0,
            locked_vendor_id=payload.locked_vendor_id,
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting
