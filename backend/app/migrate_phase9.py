import sqlite3

DB_PATH = '/home/tariss/.openclaw/workspace/vendorcompare/CC_Production_Output/Phase_1_Scaffolding/backend/vendorcompare.db'

conn = sqlite3.connect(DB_PATH)
migrations = [
    ("muted", "ALTER TABLE products ADD COLUMN muted BOOLEAN NOT NULL DEFAULT 0"),
    ("is_deleted", "ALTER TABLE products ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0"),
    ("needs_pricing", "ALTER TABLE products ADD COLUMN needs_pricing BOOLEAN NOT NULL DEFAULT 0"),
]
for col_name, sql in migrations:
    try:
        conn.execute(sql)
        conn.commit()
        print(f"Migration complete: added {col_name} to products")
    except Exception as e:
        print(f"Migration skipped or failed for {col_name}: {e}")
conn.close()
