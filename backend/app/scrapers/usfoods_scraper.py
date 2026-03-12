"""
Playwright-based scraper for US Foods MOXē portal.
Credentials via env: USFOODS_USERNAME, USFOODS_PASSWORD

Mock mode: set USFOODS_MOCK=true to load mock_usfoods.csv instead of live scraping.
"""

import os
import io
import difflib
import tempfile
from pathlib import Path
from sqlalchemy.orm import Session

from ..models import Product, Vendor
from .price_diff import compute_diff


MOCK_CSV_PATH = Path(__file__).parent / "mock_usfoods.csv"
USFOODS_VENDOR_NAME = "US Foods"


def _fuzzy_match_products(raw_name: str, product_names: list[str], threshold: float = 0.6):
    matches = difflib.get_close_matches(raw_name.lower(), [n.lower() for n in product_names], n=1, cutoff=threshold)
    if matches:
        idx = [n.lower() for n in product_names].index(matches[0])
        return product_names[idx]
    return None


def _parse_csv_to_scraped_items(csv_bytes: bytes, vendor_id: int, db: Session) -> dict:
    import pandas as pd

    df = pd.read_csv(io.BytesIO(csv_bytes))
    df.columns = [str(c).strip().lower() for c in df.columns]

    products = db.query(Product).all()
    product_name_map = {p.name: p.id for p in products}
    product_names = list(product_name_map.keys())

    scraped_items = []
    unmatched_raw = []

    name_col = next((c for c in ["product name", "item", "product", "name", "description"] if c in df.columns), None)
    price_col = next((c for c in ["price", "unit price", "cost", "each", "ea"] if c in df.columns), None)
    unit_col = next((c for c in ["unit", "uom", "pack size"] if c in df.columns), None)

    if name_col is None or price_col is None:
        # fallback: first string col is name, first numeric col is price
        name_col = df.select_dtypes(include="object").columns[0]
        price_col = df.select_dtypes(include="number").columns[0]

    for _, row in df.iterrows():
        raw_name = str(row.get(name_col, "")).strip()
        try:
            price = float(str(row.get(price_col, "")).replace("$", "").replace(",", "").strip())
        except (ValueError, TypeError):
            continue
        unit = str(row.get(unit_col, "")).strip() if unit_col else ""
        if not raw_name or price <= 0:
            continue

        matched_name = _fuzzy_match_products(raw_name, product_names)
        if matched_name:
            scraped_items.append({
                "product_id": product_name_map[matched_name],
                "vendor_id": vendor_id,
                "new_price": price,
                "unit": unit,
                "raw_name": raw_name,
                "source": "scraper",
            })
        else:
            unmatched_raw.append({"raw_name": raw_name, "new_price": price})

    result = compute_diff(scraped_items, db)
    result["unmatched"].extend(unmatched_raw)
    return result


def scrape_usfoods(db: Session) -> dict:
    """
    Scrape US Foods MOXē portal for current prices.
    In mock mode (USFOODS_MOCK=true), loads mock_usfoods.csv instead.
    """
    mock_mode = os.environ.get("USFOODS_MOCK", "").lower() in ("true", "1", "yes")
    username = os.environ.get("USFOODS_USERNAME")
    password = os.environ.get("USFOODS_PASSWORD")

    if not mock_mode and not username:
        raise ValueError("USFOODS credentials not configured")

    # Resolve vendor_id for US Foods
    vendor = db.query(Vendor).filter(Vendor.name.ilike("%us foods%")).first()
    vendor_id = vendor.id if vendor else 1

    if mock_mode:
        with open(MOCK_CSV_PATH, "rb") as f:
            csv_bytes = f.read()
        return _parse_csv_to_scraped_items(csv_bytes, vendor_id, db)

    # ── Live Playwright scraping ──────────────────────────────────────────────
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Login to MOXē portal
        page.goto("https://www.usfoods.com/moxe/login")
        page.fill('input[name="username"], input[type="email"]', username)
        page.fill('input[name="password"], input[type="password"]', password)
        page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")')
        page.wait_for_load_state("networkidle", timeout=30000)

        # Navigate to order guide / product list
        try:
            page.click('a:has-text("Order Guide"), a:has-text("My Products"), nav a:has-text("Products")', timeout=10000)
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass  # May already be on the right page

        # Look for Export / Download button
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            with page.expect_download(timeout=20000) as download_info:
                page.click(
                    'button:has-text("Export"), button:has-text("Download"), '
                    'a:has-text("Export List"), a:has-text("Download CSV")',
                    timeout=10000
                )
            download = download_info.value
            download.save_as(tmp_path)
        except Exception as e:
            browser.close()
            raise RuntimeError(f"Could not trigger US Foods export: {e}")

        browser.close()

        with open(tmp_path, "rb") as f:
            csv_bytes = f.read()
        os.unlink(tmp_path)

    return _parse_csv_to_scraped_items(csv_bytes, vendor_id, db)
