import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'vendorcompare.db')

def run():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Add taco_flag_count column to orders (idempotent)
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN taco_flag_count INTEGER NOT NULL DEFAULT 0")
        print("Added taco_flag_count column.")
    except Exception:
        print("taco_flag_count column already exists — skipping.")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    run()
