import sqlite3

conn = sqlite3.connect('/app/vendorcompare.db')
try:
    conn.execute("ALTER TABLE orders ADD COLUMN comparison_json TEXT")
    conn.commit()
    print("Migration complete: added comparison_json to orders")
except Exception as e:
    print(f"Migration skipped or failed: {e}")
conn.close()
