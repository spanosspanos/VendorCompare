"""
Admin price import/export routes for John's Glasses.
Prefix: /api/john
"""

import io
import os
import difflib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import SessionLocal
from ..models import Product, Vendor, AuditLog
from ..scrapers.price_diff import compute_diff
from ..scrapers.price_importer import import_confirmed_diffs

router = APIRouter(tags=["john"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── helpers ──────────────────────────────────────────────────────────────────

def _fuzzy_match_products(raw_name: str, product_names: list[str], threshold: float = 0.6) -> Optional[str]:
    matches = difflib.get_close_matches(raw_name.lower(), [n.lower() for n in product_names], n=1, cutoff=threshold)
    if matches:
        # Return the original-case name
        idx = [n.lower() for n in product_names].index(matches[0])
        return product_names[idx]
    return None


def _parse_file(file: UploadFile) -> tuple[list[dict], dict]:
    """
    Parse CSV, Excel, or PDF upload.
    Returns (rows, column_mapping) where rows are raw dicts.
    """
    filename = file.filename.lower()
    content = file.file.read()

    if filename.endswith(".csv"):
        import pandas as pd
        df = pd.read_csv(io.BytesIO(content))
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        import pandas as pd
        df = pd.read_excel(io.BytesIO(content))
    elif filename.endswith(".pdf"):
        import pdfplumber
        rows = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                table = page.extract_table()
                if table:
                    headers = [str(h).strip() if h else "" for h in table[0]]
                    for row in table[1:]:
                        rows.append(dict(zip(headers, [str(c).strip() if c else "" for c in row])))
        import pandas as pd
        df = pd.DataFrame(rows)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use CSV, XLSX, or PDF.")

    # Normalize column names
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Detect name column
    name_col = None
    for candidate in ["item", "product", "name", "description", "item name", "product name"]:
        if candidate in df.columns:
            name_col = candidate
            break
    if name_col is None:
        # Try partial match
        for col in df.columns:
            if any(k in col for k in ["item", "product", "name", "desc"]):
                name_col = col
                break

    # Detect price column
    price_col = None
    for candidate in ["price", "unit price", "cost", "unit cost", "each", "ea price"]:
        if candidate in df.columns:
            price_col = candidate
            break
    if price_col is None:
        for col in df.columns:
            if any(k in col for k in ["price", "cost", "each"]):
                price_col = col
                break

    if name_col is None or price_col is None:
        raise HTTPException(
            status_code=422,
            detail=f"Could not detect required columns. Found: {list(df.columns)}. Need item/product/name and price/cost column."
        )

    # Detect unit column (optional)
    unit_col = None
    for candidate in ["unit", "uom", "pack size", "pack", "size"]:
        if candidate in df.columns:
            unit_col = candidate
            break

    column_mapping = {"name": name_col, "price": price_col, "unit": unit_col}

    rows = []
    for _, row in df.iterrows():
        name = str(row.get(name_col, "")).strip()
        try:
            price = float(str(row.get(price_col, "")).replace("$", "").replace(",", "").strip())
        except (ValueError, TypeError):
            continue
        unit = str(row.get(unit_col, "")).strip() if unit_col else ""
        if name and price > 0:
            rows.append({"raw_name": name, "price": price, "unit": unit})

    return rows, column_mapping


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/import-prices")
async def import_prices(
    file: UploadFile = File(...),
    vendor_id: int = Query(...),
    db: Session = Depends(get_db),
):
    rows, column_mapping = _parse_file(file)

    products = db.query(Product).all()
    product_name_map = {p.name: p.id for p in products}
    product_names = list(product_name_map.keys())

    scraped_items = []
    unmatched = []

    for row in rows:
        raw_name = row["raw_name"]
        matched_name = _fuzzy_match_products(raw_name, product_names)
        if matched_name:
            scraped_items.append({
                "product_id": product_name_map[matched_name],
                "vendor_id": vendor_id,
                "new_price": row["price"],
                "unit": row["unit"],
                "raw_name": raw_name,
            })
        else:
            unmatched.append({"raw_name": raw_name, "new_price": row["price"]})

    result = compute_diff(scraped_items, db)
    result["vendor_id"] = vendor_id
    result["column_mapping"] = column_mapping
    result["unmatched"].extend(unmatched)

    return result


class ConfirmPricesRequest(BaseModel):
    diffs: list[dict]
    vendor_id: int


@router.post("/confirm-prices")
def confirm_prices(payload: ConfirmPricesRequest, db: Session = Depends(get_db)):
    count = import_confirmed_diffs(payload.diffs, payload.vendor_id, db)
    return {"imported": count}


@router.get("/price-audit-log")
def price_audit_log(db: Session = Depends(get_db)):
    entries = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(100)
        .all()
    )
    result = []
    for e in entries:
        result.append({
            "id": e.id,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "vendor_id": e.vendor_id,
            "vendor_name": e.vendor.name if e.vendor else None,
            "product_id": e.product_id,
            "product_name": e.product.name if e.product else None,
            "old_price": e.old_price,
            "new_price": e.new_price,
            "source": e.source,
        })
    return result


@router.post("/scrape-usfoods")
async def scrape_usfoods(db: Session = Depends(get_db)):
    mock_mode = os.environ.get("USFOODS_MOCK", "").lower() in ("true", "1", "yes")
    has_creds = bool(os.environ.get("USFOODS_USERNAME"))

    if not mock_mode and not has_creds:
        raise HTTPException(
            status_code=400,
            detail="US Foods credentials not configured. Set USFOODS_USERNAME and USFOODS_PASSWORD env vars, or set USFOODS_MOCK=true for mock mode."
        )

    from ..scrapers.usfoods_scraper import scrape_usfoods as _scrape
    result = _scrape(db)
    return result
