import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'vendorcompare.db')


def run():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Add review_note column to orders (idempotent)
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN review_note TEXT")
        print("Added review_note column.")
    except Exception:
        print("review_note column already exists — skipping.")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    run()
