"""
Idempotent price seed script for VendorCompare database.
Run: python -m app.seed_prices
"""

import random
from datetime import date

from .database import SessionLocal
from .models import Product, Vendor, Price, Category


# Realistic base prices by category (product_name -> (base_price, unit))
CATEGORY_PRICE_RANGES = {
    "Fridge": (15, 80),
    "Proteins": (40, 200),
    "Produce": (10, 60),
    "Spices": (8, 45),
    "Dry Goods": (12, 90),
    "Dishwashing Machine": (25, 120),
}

# Per-product overrides for realistic pricing and units
PRODUCT_DETAILS = {
    # Fridge
    "Plantains": (28.00, "case"),
    "12 Inch Flour Tortillas": (22.50, "case"),
    "5 Inch Flour Tortillas": (18.00, "case"),
    "Empanada Discos": (24.00, "case"),
    "Eggs X-Large Loose": (45.00, "case"),
    "Heavy Mayonnaise": (32.00, "gallon"),
    "Sour Cream": (19.50, "each"),
    "Queso Fresco": (35.00, "case"),
    "Oaxaca": (42.00, "case"),
    "Shred Cheese Quesadilla": (38.00, "case"),
    "Cotija": (40.00, "case"),
    "Strawberry Puree Island Oasis": (52.00, "case"),
    "Passion Fruit Puree Island Oasis": (55.00, "case"),
    "Fresh Lime Juice": (28.00, "gallon"),
    "Goat Cheese": (48.00, "case"),
    "Ginger Beer": (36.00, "case"),
    # Proteins
    "Chicken Thigh": (62.00, "case"),
    "Wings": (85.00, "case"),
    "Pork Belly": (95.00, "case"),
    "Pork Butt": (78.00, "case"),
    "Steak": (185.00, "case"),
    "Chorizo": (58.00, "case"),
    "Fish": (120.00, "case"),
    "51-60 Shrimp": (72.00, "case"),
    "16-20 Shrimp": (145.00, "case"),
    "Frozen Falafel": (48.00, "case"),
    # Produce
    "Plum Tomato": (28.00, "case"),
    "Spanish Onion": (22.00, "bag"),
    "Red Pepper": (35.00, "case"),
    "Green Pepper": (30.00, "case"),
    "Tomatillos": (25.00, "case"),
    "Limes": (32.00, "case"),
    "Jalapeños": (18.00, "case"),
    "Red Cabbage": (15.00, "each"),
    "Romaine Lettuce": (24.00, "case"),
    "Mint": (12.00, "each"),
    "Cilantro": (14.00, "each"),
    "Parsley": (14.00, "each"),
    "Orange": (38.00, "case"),
    "Pineapple (Market)": (45.00, "case"),
    "Avocado": (55.00, "case"),
    "Spinach": (22.00, "case"),
    "Arugula": (28.00, "case"),  # Produce arugula
    "Corn": (18.00, "case"),
    "Fresh Garlic": (32.00, "case"),
    # Spices
    "Onion Powder": (12.00, "each"),
    "Garlic Powder": (12.50, "each"),
    "Bay Leaves": (9.00, "each"),
    "Black Pepper": (18.00, "each"),
    "Kosher Salt": (8.50, "box"),
    "Spanish Paprika": (14.00, "each"),
    "Dark Chili Powder": (15.00, "each"),
    "Old Bay": (16.00, "each"),
    "Guajillo": (22.00, "bag"),
    "Tamarind": (18.00, "each"),
    "Oregano Flakes": (10.00, "each"),
    "Oregano Leaves": (11.00, "each"),
    "Chili de Arbol": (20.00, "bag"),
    "Hibiscus": (25.00, "bag"),
    "Crushed Red Pepper": (14.00, "each"),
    "Thyme": (10.50, "each"),
    "Cumin": (13.00, "each"),
    "Cinnamon Sticks": (28.00, "bag"),
    "Chile Pastilla": (32.00, "bag"),
    "Piloncillo": (15.00, "bag"),
    # Dry Goods
    "Black Wrapped Plastic Straws": (28.00, "box"),
    "Flour": (24.00, "bag"),
    "Maseca": (22.00, "bag"),
    "Sugar": (20.00, "bag"),
    "Canned Corn": (32.00, "case"),
    "Black Beans": (28.00, "case"),
    "White Vinegar": (12.00, "gallon"),
    "Red Wine Vinegar": (18.00, "gallon"),
    "Sherry Vinegar": (22.00, "gallon"),
    "Tomato Juice": (15.00, "case"),
    "Pineapple Juice": (18.00, "case"),
    "Ranch Dressing": (24.00, "gallon"),
    "Blue Cheese Dressing": (28.00, "gallon"),
    "Tortilla Chips for Table": (32.00, "case"),
    "Mango Puree": (35.00, "case"),
    "Parboiled Rice": (25.00, "bag"),
    "Honey": (42.00, "gallon"),
    "Sazon": (16.00, "box"),
    "Canola Oil": (28.00, "gallon"),
    "Yucatec Green Sauce": (15.00, "each"),
    "Yucatec Red Sauce": (15.00, "each"),
    "Aluminum Foil 7/11 Sheets": (45.00, "case"),
    "Large Aluminum Foil Roll": (55.00, "each"),
    "Cocktail Napkins": (32.00, "case"),
    "Dinner Napkins": (38.00, "case"),
    "7 Inch Aluminum Plates": (42.00, "case"),
    "7 Inch Flat Lids": (38.00, "case"),
    "8 Inch Aluminum Plates": (48.00, "case"),
    "8 Inch Flat Lids": (42.00, "case"),
    "Plastic Shopping Bags": (25.00, "case"),
    "Black Garbage Bags": (35.00, "case"),
    "#8 White Paper Bags": (18.00, "case"),
    "#12 White Paper Bags": (20.00, "case"),
    "#20 White Paper Bags": (24.00, "case"),
    "Toilet Tissue": (52.00, "case"),
    "Bleach": (15.00, "gallon"),
    "Printer Paper Floor 7313 SP": (45.00, "case"),
    "Printer Paper Kitchen 2300 SP": (45.00, "case"),
    "Meal Kit Combo Packs": (65.00, "case"),
    "2 oz Black Soufflé Cups": (28.00, "case"),
    "2 oz Soufflé Lids": (25.00, "case"),
    "Large Plastic Gloves": (22.00, "box"),
    "Small Plastic Gloves": (22.00, "box"),
    "32 oz Soup Combo Packs": (55.00, "case"),
    "Wax Paper SW6": (18.00, "box"),
    "Wax Paper SW10": (22.00, "box"),
    "Large Plastic Film Wrap": (35.00, "each"),
    "Small Plastic Film Wrap": (25.00, "each"),
    "Buffalo Sauce": (28.00, "gallon"),
    "Whipped Cream": (42.00, "case"),
    "Pot & Pan Soap": (18.00, "gallon"),
    "Lavender Floor Cleaner": (22.00, "gallon"),
    "Pine Wood Floor Cleaner": (20.00, "gallon"),
    "Hand Soap": (15.00, "gallon"),
    "Maraschino Cherries": (28.00, "each"),
    "Soy Sauce": (16.00, "gallon"),
    # Dishwashing Machine
    "Red 'Cleaner'": (85.00, "each"),
    "Blue 'Glass Dry'": (75.00, "each"),
    "Yellow 'Sanitizer'": (90.00, "each"),
}


def seed_prices():
    db = SessionLocal()

    try:
        products = db.query(Product).join(Category).all()
        vendors = db.query(Vendor).all()

        if not products:
            print("No products found. Run seed.py first.")
            return
        if not vendors:
            print("No vendors found. Run seed.py first.")
            return

        vendor_ids = [v.id for v in vendors]
        today = date.today().isoformat()

        random.seed(42)  # Reproducible results

        # Determine coverage: 60% = 3 vendors, 30% = 2 vendors, 10% = 1 vendor
        n = len(products)
        three_vendor_count = round(n * 0.60)
        two_vendor_count = round(n * 0.30)
        one_vendor_count = n - three_vendor_count - two_vendor_count

        shuffled = list(products)
        random.shuffle(shuffled)

        three_vendor_products = shuffled[:three_vendor_count]
        two_vendor_products = shuffled[three_vendor_count:three_vendor_count + two_vendor_count]
        one_vendor_products = shuffled[three_vendor_count + two_vendor_count:]

        inserted = 0
        coverage = {3: 0, 2: 0, 1: 0}

        for product in three_vendor_products:
            assigned_vendors = vendor_ids  # all 3
            inserted += _insert_prices(db, product, assigned_vendors, vendors, today)
            coverage[3] += 1

        for i, product in enumerate(two_vendor_products):
            # Rotate which 2 vendors carry it
            pairs = [
                [vendor_ids[0], vendor_ids[1]],
                [vendor_ids[0], vendor_ids[2]],
                [vendor_ids[1], vendor_ids[2]],
            ]
            assigned_vendors = pairs[i % 3]
            inserted += _insert_prices(db, product, assigned_vendors, vendors, today)
            coverage[2] += 1

        for i, product in enumerate(one_vendor_products):
            # Spread across vendors
            assigned_vendors = [vendor_ids[i % len(vendor_ids)]]
            inserted += _insert_prices(db, product, assigned_vendors, vendors, today)
            coverage[1] += 1

        db.commit()

        # Verify
        total_prices = db.query(Price).count()
        print(f"\nPrice seed complete.")
        print(f"Total price records: {total_prices}")
        print(f"Products with 3-vendor coverage: {coverage[3]}")
        print(f"Products with 2-vendor coverage: {coverage[2]}")
        print(f"Products with 1-vendor coverage: {coverage[1]}")

    except Exception as e:
        db.rollback()
        print(f"Price seed failed: {e}")
        raise
    finally:
        db.close()


def _insert_prices(db, product, assigned_vendor_ids, vendors, today):
    """Insert prices for a product across its assigned vendors. Idempotent."""
    base_price, unit = _get_product_details(product)
    inserted = 0

    for vid in assigned_vendor_ids:
        existing = (
            db.query(Price)
            .filter_by(product_id=product.id, vendor_id=vid)
            .first()
        )
        if existing:
            continue

        # Vary price ±10-20% from base
        variance = random.uniform(-0.20, 0.20)
        # Ensure at least 10% variance magnitude for multi-vendor products
        if abs(variance) < 0.10:
            variance = 0.10 if variance >= 0 else -0.10
        vendor_price = round(base_price * (1 + variance), 2)

        price_record = Price(
            product_id=product.id,
            vendor_id=vid,
            price=vendor_price,
            unit=unit,
        )
        db.add(price_record)
        inserted += 1

    return inserted


def _get_product_details(product):
    """Get base price and unit for a product."""
    if product.name in PRODUCT_DETAILS:
        return PRODUCT_DETAILS[product.name]

    # Fallback to category range
    category_name = product.category.name if product.category else "Dry Goods"
    low, high = CATEGORY_PRICE_RANGES.get(category_name, (15, 60))
    return (round(random.uniform(low, high), 2), "each")


if __name__ == "__main__":
    seed_prices()
