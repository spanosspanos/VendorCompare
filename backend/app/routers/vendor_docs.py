"""Vendor Docs router — file upload, parsing, archive, cross-vendor search.
Prefix: /api/vendor-docs
"""
import os
import re
import uuid
import shutil
import pdfplumber
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from ..database import get_db
from ..models import Vendor, VendorDocument, VendorArchiveItem, Product, Price
from ..auth_deps import get_current_role, require_admin

router = APIRouter(prefix="/api/vendor-docs", tags=["vendor-docs"])

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
ALGORITHM = "HS256"

# In-memory preview storage: preview_id -> list of parsed items + matched results
_previews: dict[str, dict] = {}

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'vendor_docs')


def get_current_employee_name(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        return "unknown"
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("name") or payload.get("sub") or "unknown"
    except JWTError:
        return "unknown"


# ── Parsing ────────────────────────────────────────────────────────────────


def parse_food_direct_pdf(filepath):
    pattern = re.compile(r'([A-Z0-9\-]+)\s+([A-Z][^$#\n]+?)(?:#\S+\s+)?\$(\d+\.\d+)')
    items = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.split('\n'):
                matches = pattern.findall(line)
                for match in matches:
                    sku = match[0]
                    desc = match[1].strip()
                    price = float(match[2])
                    if desc:
                        items.append({"sku": sku, "description": desc, "price": price, "unit": "each"})
    return items


def _open_csv(filepath):
    """Open a CSV trying utf-8-sig first, then latin-1 (covers Windows/cp1252 exports)."""
    for enc in ('utf-8-sig', 'latin-1'):
        try:
            f = open(filepath, newline='', encoding=enc)
            f.read(1024)
            f.seek(0)
            return f
        except (UnicodeDecodeError, LookupError):
            try:
                f.close()
            except Exception:
                pass
    return open(filepath, newline='', encoding='latin-1', errors='replace')


def parse_csv_file(filepath):
    import csv
    items = []
    with _open_csv(filepath) as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalize keys to lowercase for case-insensitive matching (handles US Foods, Food Direct, etc.)
            lrow = {(k.lower().strip() if k else ''): v for k, v in row.items()}
            desc = (lrow.get('product description') or lrow.get('description') or
                    lrow.get('name') or lrow.get('item') or lrow.get('product') or '')
            if isinstance(desc, str):
                desc = desc.strip()
            price_str = (lrow.get('price') or lrow.get('unit price') or lrow.get('cost') or
                         lrow.get('your price') or lrow.get('contract price') or None)
            price = None
            if price_str:
                try:
                    price = float(str(price_str).replace('$', '').replace(',', '').strip())
                    if price <= 0:
                        price = None
                except ValueError:
                    price = None
            sku = (lrow.get('product number') or lrow.get('sku') or lrow.get('item number') or
                   lrow.get('product #') or None)
            if sku:
                sku = str(sku).strip()
            unit = (lrow.get('product package size') or lrow.get('pack size') or
                    lrow.get('unit') or lrow.get('uom') or 'each')
            if isinstance(unit, str):
                unit = unit.strip()
            if desc:
                items.append({"sku": sku, "description": desc, "price": price, "unit": unit})
    return items


def parse_excel_file(filepath):
    try:
        import openpyxl
        wb = openpyxl.load_workbook(filepath, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h).lower().strip() if h else '' for h in rows[0]]
        items = []
        for row in rows[1:]:
            row_dict = dict(zip(headers, row))
            desc = row_dict.get('description') or row_dict.get('name') or row_dict.get('item') or ''
            price = row_dict.get('price') or row_dict.get('cost')
            try:
                price = float(price) if price is not None else None
            except (ValueError, TypeError):
                price = None
            sku = row_dict.get('sku') or None
            unit = row_dict.get('unit') or 'each'
            if desc:
                items.append({"sku": str(sku) if sku else None, "description": str(desc), "price": price, "unit": str(unit)})
        return items
    except ImportError:
        return []


def _detect_pdf_vendor(filepath):
    """Scan up to 3 pages to distinguish US Foods from Food Direct PDFs."""
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages[:3]:
                text = (page.extract_text() or '').lower()
                if 'us foods' in text or 'usfoods' in text or 'moxe' in text:
                    return 'usfoods'
            # Secondary signal: any page has table structure typical of US Foods
            # (header row containing "product description" and "product #")
            for page in pdf.pages[:5]:
                for table in (page.extract_tables() or []):
                    for row in (table or [])[:3]:
                        row_text = ' '.join(str(c).lower() for c in row if c)
                        if 'product description' in row_text and ('product #' in row_text or 'product number' in row_text):
                            return 'usfoods'
    except Exception:
        pass
    return 'food_direct'


def parse_usfoods_pdf(filepath):
    items = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            for table in (page.extract_tables() or []):
                if not table or len(table) < 2:
                    continue
                header_row = None
                data_start = 0
                for i, row in enumerate(table):
                    row_text = ' '.join(str(c).lower() for c in row if c)
                    if 'product' in row_text and ('description' in row_text or '#' in row_text):
                        header_row = [str(c).lower().strip() if c else '' for c in row]
                        data_start = i + 1
                        break
                if not header_row:
                    continue

                def find_col(names):
                    for name in names:
                        for idx, h in enumerate(header_row):
                            if name in h:
                                return idx
                    return None

                desc_col = find_col(['product description', 'description'])
                sku_col = find_col(['product #', 'product number', 'product#'])
                unit_col = find_col(['pack size', 'unit'])
                if desc_col is None:
                    continue

                for row in table[data_start:]:
                    if not row or len(row) <= desc_col:
                        continue
                    desc = str(row[desc_col] or '').replace('\n', ' ').strip()
                    if not desc:
                        continue
                    # Skip section header rows like "Chicken/Beef/Pork (10 products)"
                    if 'products)' in desc.lower() or desc.lower() in ('product description',):
                        continue
                    sku = str(row[sku_col] or '').strip() if sku_col is not None and len(row) > sku_col else None
                    unit = str(row[unit_col] or '').strip() if unit_col is not None and len(row) > unit_col else 'each'
                    if desc and sku:
                        items.append({"sku": sku, "description": desc, "price": None, "unit": unit or 'each'})
    return items


def parse_file(filepath, filename):
    lower = filename.lower()
    if lower.endswith('.pdf'):
        vendor = _detect_pdf_vendor(filepath)
        if vendor == 'usfoods':
            return parse_usfoods_pdf(filepath)
        return parse_food_direct_pdf(filepath)
    elif lower.endswith('.csv'):
        return parse_csv_file(filepath)
    elif lower.endswith(('.xlsx', '.xls')):
        return parse_excel_file(filepath)
    return []


# ── Matching ───────────────────────────────────────────────────────────────


def normalize_text(text):
    text = text.lower()
    text = re.sub(r'[,./()#]', ' ', text)
    replacements = {
        'bnls': 'boneless', 'chkn': 'chicken', 'sknls': 'skinless',
        'brst': 'breast', 'thgh': 'thigh', 'whl': 'whole',
        'lb': 'lb', 'cs': 'case',
    }
    for abbr, full in replacements.items():
        text = re.sub(r'\b' + abbr + r'\b', full, text)
    return text


def match_product(sku, description, products):
    norm_desc = normalize_text(description)
    best = None
    best_score = 0
    for p in products:
        norm_name = normalize_text(p.name)
        desc_tokens = set(norm_desc.split())
        name_tokens = set(norm_name.split())
        overlap = len(desc_tokens & name_tokens)
        if overlap > 0:
            # Score against the shorter side: if every word of the product name
            # appears in the (potentially verbose) vendor description, it's a match.
            score = overlap / min(len(desc_tokens), len(name_tokens))
            if score > best_score and score >= 0.4:
                best_score = score
                best = p
    return best, best_score


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/upload/{vendor_id}")
async def upload_vendor_doc(
    vendor_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    employee_name: str = Depends(get_current_employee_name),
):
    require_admin(role)

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == False).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or 'upload.pdf')[1]
    temp_filename = f"preview_{vendor_id}_{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)

    with open(temp_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    try:
        parsed_items = parse_file(temp_path, file.filename or '')
    except Exception as e:
        os.remove(temp_path)
        raise HTTPException(status_code=422, detail=f"Parse error: {str(e)}")

    # Match against products
    products = db.query(Product).filter(Product.is_deleted == False).all()
    matched_items = []
    unmatched_count = 0

    for item in parsed_items:
        product, score = match_product(item.get('sku'), item['description'], products)
        if product:
            # Get current price for this vendor
            current_price = db.query(Price).filter(
                Price.product_id == product.id,
                Price.vendor_id == vendor_id,
            ).order_by(Price.updated_at.desc()).first()
            old_price = current_price.price if current_price else None
            matched_items.append({
                "product_id": product.id,
                "product_name": product.name,
                "sku": item.get('sku'),
                "old_price": old_price,
                "new_price": item['price'],
            })
        else:
            unmatched_count += 1

    preview_id = str(uuid.uuid4())
    _previews[preview_id] = {
        "parsed_items": parsed_items,
        "matched_items": matched_items,
        "temp_path": temp_path,
        "vendor_id": vendor_id,
        "employee_name": employee_name,
    }

    sample_changes = matched_items[:5]

    return {
        "preview_id": preview_id,
        "matched_items": matched_items,
        "unmatched_count": unmatched_count,
        "total_items": len(parsed_items),
        "sample_changes": sample_changes,
    }


class ConfirmRequest(BaseModel):
    preview_id: str
    filename: str
    item_count: int


@router.post("/confirm/{vendor_id}")
def confirm_vendor_doc(
    vendor_id: int,
    req: ConfirmRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    employee_name: str = Depends(get_current_employee_name),
):
    require_admin(role)

    preview = _previews.get(req.preview_id)
    if not preview:
        raise HTTPException(status_code=404, detail="Preview not found or expired")
    if preview["vendor_id"] != vendor_id:
        raise HTTPException(status_code=400, detail="Preview vendor mismatch")

    matched_items = preview["matched_items"]
    parsed_items = preview["parsed_items"]
    temp_path = preview.get("temp_path")
    uploader = preview.get("employee_name") or employee_name

    # Move temp file to permanent path
    final_filename = f"{vendor_id}_{uuid.uuid4().hex}_{req.filename}"
    final_path = os.path.join(UPLOAD_DIR, final_filename)
    if temp_path and os.path.exists(temp_path):
        shutil.move(temp_path, final_path)
    else:
        final_path = temp_path or ""

    # Mark all previous docs for this vendor as not most recent
    db.query(VendorDocument).filter(
        VendorDocument.vendor_id == vendor_id,
        VendorDocument.is_most_recent == True,
    ).update({"is_most_recent": False})

    # Create VendorDocument record
    doc = VendorDocument(
        vendor_id=vendor_id,
        filename=req.filename,
        filepath=final_path,
        uploaded_by=uploader,
        item_count=req.item_count,
        is_most_recent=True,
    )
    db.add(doc)
    db.flush()

    # Commit price changes
    products = db.query(Product).filter(Product.is_deleted == False).all()
    product_map = {p.id: p for p in products}
    committed_count = 0

    for match in matched_items:
        product = product_map.get(match["product_id"])
        if not product or match["new_price"] is None:
            continue
        existing_price = db.query(Price).filter(
            Price.product_id == product.id,
            Price.vendor_id == vendor_id,
        ).order_by(Price.updated_at.desc()).first()
        if existing_price:
            existing_price.price = match["new_price"]
            existing_price.is_manual = False
            existing_price.updated_at = datetime.now(timezone.utc)
        else:
            new_price = Price(
                product_id=product.id,
                vendor_id=vendor_id,
                price=match["new_price"],
                is_manual=False,
            )
            db.add(new_price)
        committed_count += 1

    # Create archive items for ALL parsed items (deduplicated by SKU+description)
    seen_keys = set()
    for item in parsed_items:
        dedup_key = (item.get('sku'), item['description'])
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        archive_item = VendorArchiveItem(
            vendor_doc_id=doc.id,
            sku=item.get('sku'),
            description=item['description'],
            price=item.get('price'),
            unit=item.get('unit'),
        )
        db.add(archive_item)

    db.commit()

    # Clean up preview
    del _previews[req.preview_id]

    return {"committed_count": committed_count, "doc_id": doc.id}


@router.get("/archive/{vendor_id}")
def get_vendor_archive(
    vendor_id: int,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)
    docs = db.query(VendorDocument).filter(
        VendorDocument.vendor_id == vendor_id,
    ).order_by(VendorDocument.uploaded_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "uploaded_by": d.uploaded_by,
            "uploaded_at": d.uploaded_at,
            "item_count": d.item_count,
            "is_most_recent": d.is_most_recent,
        }
        for d in docs
    ]


@router.get("/search")
def search_archive(
    q: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)
    if not q.strip():
        return []

    norm_q = normalize_text(q.strip())
    q_tokens = set(norm_q.split())

    # Get most-recent docs per vendor
    most_recent_docs = db.query(VendorDocument).filter(
        VendorDocument.is_most_recent == True,
    ).all()

    results = []
    for doc in most_recent_docs:
        vendor = db.query(Vendor).filter(Vendor.id == doc.vendor_id, Vendor.is_deleted == False).first()
        if not vendor:
            continue
        for item in doc.archive_items:
            norm_desc = normalize_text(item.description)
            desc_tokens = set(norm_desc.split())
            overlap = len(q_tokens & desc_tokens)
            if overlap > 0:
                score = overlap / max(len(q_tokens), len(desc_tokens))
                results.append({
                        "vendor_id": vendor.id,
                        "vendor_name": vendor.name,
                        "sku": item.sku,
                        "description": item.description,
                        "price": item.price,
                        "unit": item.unit,
                        "uploaded_at": doc.uploaded_at,
                        "_score": score,
                    })

    results.sort(key=lambda x: x["_score"], reverse=True)
    for r in results:
        del r["_score"]
    return results
