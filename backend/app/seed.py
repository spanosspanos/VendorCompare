"""
Idempotent seed script for VendorCompare database.
Run: python -m app.seed
"""

from .database import engine, SessionLocal, Base
from .models import Location, Category, Vendor, Product

LOCATION = {"name": "White Plains", "address": "White Plains, NY"}

VENDORS = [
    {"name": "Food Direct"},
    {"name": "US Foods"},
    {"name": "Riviera Produce"},
]

CATEGORIES_WITH_PRODUCTS = [
    {
        "name": "Fridge",
        "sort_order": 0,
        "products": [
            "Plantains",
            "12 Inch Flour Tortillas",
            "5 Inch Flour Tortillas",
            "Empanada Discos",
            "Eggs X-Large Loose",
            "Heavy Mayonnaise",
            "Sour Cream",
            "Queso Fresco",
            "Oaxaca",
            "Shred Cheese Quesadilla",
            "Cotija",
            "Strawberry Puree Island Oasis",
            "Passion Fruit Puree Island Oasis",
            "Fresh Lime Juice",
            "Goat Cheese",
            "Ginger Beer",
        ],
    },
    {
        "name": "Proteins",
        "sort_order": 1,
        "products": [
            "Chicken Thigh",
            "Wings",
            "Pork Belly",
            "Pork Butt",
            "Steak",
            "Chorizo",
            "Fish",
            "51-60 Shrimp",
            "16-20 Shrimp",
            "Frozen Falafel",
        ],
    },
    {
        "name": "Produce",
        "sort_order": 2,
        "products": [
            "Plum Tomato",
            "Spanish Onion",
            "Red Pepper",
            "Green Pepper",
            "Tomatillos",
            "Limes",
            "Jalapeños",
            "Red Cabbage",
            "Romaine Lettuce",
            "Mint",
            "Cilantro",
            "Parsley",
            "Orange",
            "Pineapple (Market)",
            "Avocado",
            "Spinach",
            "Arugula",
            "Corn",
            "Fresh Garlic",
        ],
    },
    {
        "name": "Spices",
        "sort_order": 3,
        "products": [
            "Onion Powder",
            "Garlic Powder",
            "Bay Leaves",
            "Black Pepper",
            "Kosher Salt",
            "Spanish Paprika",
            "Dark Chili Powder",
            "Old Bay",
            "Guajillo",
            "Tamarind",
            "Oregano Flakes",
            "Oregano Leaves",
            "Chili de Arbol",
            "Hibiscus",
            "Crushed Red Pepper",
            "Thyme",
            "Cumin",
            "Cinnamon Sticks",
            "Chile Pastilla",
            "Piloncillo",
        ],
    },
    {
        "name": "Dry Goods",
        "sort_order": 4,
        "products": [
            "Black Wrapped Plastic Straws",
            "Flour",
            "Maseca",
            "Sugar",
            "Canned Corn",
            "Black Beans",
            "White Vinegar",
            "Red Wine Vinegar",
            "Sherry Vinegar",
            "Tomato Juice",
            "Pineapple Juice",
            "Ranch Dressing",
            "Blue Cheese Dressing",
            "Tortilla Chips for Table",
            "Mango Puree",
            "Parboiled Rice",
            "Arugula",
            "Honey",
            "Sazon",
            "Canola Oil",
            "Yucatec Green Sauce",
            "Yucatec Red Sauce",
            "Aluminum Foil 7/11 Sheets",
            "Large Aluminum Foil Roll",
            "Cocktail Napkins",
            "Dinner Napkins",
            "7 Inch Aluminum Plates",
            "7 Inch Flat Lids",
            "8 Inch Aluminum Plates",
            "8 Inch Flat Lids",
            "Plastic Shopping Bags",
            "Black Garbage Bags",
            "#8 White Paper Bags",
            "#12 White Paper Bags",
            "#20 White Paper Bags",
            "Toilet Tissue",
            "Bleach",
            "Printer Paper Floor 7313 SP",
            "Printer Paper Kitchen 2300 SP",
            "Meal Kit Combo Packs",
            "2 oz Black Soufflé Cups",
            "2 oz Soufflé Lids",
            "Large Plastic Gloves",
            "Small Plastic Gloves",
            "32 oz Soup Combo Packs",
            "Wax Paper SW6",
            "Wax Paper SW10",
            "Large Plastic Film Wrap",
            "Small Plastic Film Wrap",
            "Buffalo Sauce",
            "Whipped Cream",
            "Pot & Pan Soap",
            "Lavender Floor Cleaner",
            "Pine Wood Floor Cleaner",
            "Hand Soap",
            "Maraschino Cherries",
            "Soy Sauce",
        ],
    },
    {
        "name": "Dishwashing Machine",
        "sort_order": 5,
        "products": [
            "Red 'Cleaner'",
            "Blue 'Glass Dry'",
            "Yellow 'Sanitizer'",
        ],
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Location (idempotent)
        location = db.query(Location).filter_by(name=LOCATION["name"]).first()
        if not location:
            location = Location(**LOCATION)
            db.add(location)
            db.flush()
            print(f"Created location: {location.name}")
        else:
            print(f"Location already exists: {location.name}")

        # Vendors (idempotent)
        for v_data in VENDORS:
            vendor = db.query(Vendor).filter_by(name=v_data["name"]).first()
            if not vendor:
                vendor = Vendor(**v_data)
                db.add(vendor)
                print(f"Created vendor: {vendor.name}")
            else:
                print(f"Vendor already exists: {vendor.name}")
        db.flush()

        # Categories and Products (idempotent)
        total_products = 0
        for cat_data in CATEGORIES_WITH_PRODUCTS:
            category = db.query(Category).filter_by(name=cat_data["name"]).first()
            if not category:
                category = Category(
                    name=cat_data["name"], sort_order=cat_data["sort_order"]
                )
                db.add(category)
                db.flush()
                print(f"Created category: {category.name}")
            else:
                print(f"Category already exists: {category.name}")

            for idx, product_name in enumerate(cat_data["products"]):
                existing = (
                    db.query(Product)
                    .filter_by(name=product_name, category_id=category.id)
                    .first()
                )
                if not existing:
                    product = Product(
                        name=product_name,
                        category_id=category.id,
                        sort_order=idx,
                    )
                    db.add(product)
                    total_products += 1

        db.commit()
        print(f"\nSeed complete. Added {total_products} new products.")

        # Summary
        product_count = db.query(Product).count()
        category_count = db.query(Category).count()
        vendor_count = db.query(Vendor).count()
        print(
            f"Database totals: {product_count} products, "
            f"{category_count} categories, {vendor_count} vendors"
        )

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
