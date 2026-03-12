"""
Phase 10 migration: Add muted, is_deleted, needs_pricing to products table.
"""
import sqlite3

DB_PATH = '/app/vendorcompare.db'

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

migrations = [
    ("muted", "ALTER TABLE products ADD COLUMN muted BOOLEAN NOT NULL DEFAULT 0"),
    ("is_deleted", "ALTER TABLE products ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0"),
    ("needs_pricing", "ALTER TABLE products ADD COLUMN needs_pricing BOOLEAN NOT NULL DEFAULT 0"),
]

for col_name, sql in migrations:
    try:
        cursor.execute(sql)
        conn.commit()
        print(f"Migration complete: added '{col_name}' to products")
    except Exception as e:
        print(f"Migration skipped or failed for '{col_name}': {e}")

conn.close()
print("Phase 10 migration done.")
