import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'vendorcompare.db')

def run():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create par_settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS par_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id),
            location_id INTEGER NOT NULL REFERENCES locations(id),
            par_value INTEGER NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(product_id, location_id)
        )
    """)

    # Add columns to orders (idempotent)
    for col_sql in [
        "ALTER TABLE orders ADD COLUMN notes_to_john TEXT",
        "ALTER TABLE orders ADD COLUMN requires_review BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN review_status TEXT NOT NULL DEFAULT 'not_required'",
    ]:
        try:
            cursor.execute(col_sql)
        except Exception:
            pass  # Column already exists

    # Add columns to order_items (idempotent)
    for col_sql in [
        "ALTER TABLE order_items ADD COLUMN item_note TEXT",
        "ALTER TABLE order_items ADD COLUMN flag TEXT",
    ]:
        try:
            cursor.execute(col_sql)
        except Exception:
            pass  # Column already exists

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    run()
