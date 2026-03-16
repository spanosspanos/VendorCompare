# migrate_014a.py
import sqlite3, os

DB_PATH = os.environ.get("DATABASE_URL", "/opt/vendorcompare/backend/vendorcompare.db").replace("sqlite:///", "")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Add origin_route column if not exists
    cur.execute("PRAGMA table_info(orders)")
    cols = [row[1] for row in cur.fetchall()]
    
    if "origin_route" not in cols:
        cur.execute("ALTER TABLE orders ADD COLUMN origin_route VARCHAR")
        print("Added origin_route column")
    else:
        print("origin_route already exists — skipping")
    
    if "employee_name" not in cols:
        cur.execute("ALTER TABLE orders ADD COLUMN employee_name VARCHAR")
        print("Added employee_name column")
    else:
        print("employee_name already exists — skipping")
    
    conn.commit()
    conn.close()
    print("Migration 014a complete")

if __name__ == "__main__":
    migrate()
