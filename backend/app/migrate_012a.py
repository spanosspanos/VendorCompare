"""Migration 012A: Add is_manual to prices table
Up: adds is_manual BOOLEAN column (default False)
Down: recreates prices table without is_manual column
"""
import sqlite3
import os

def _db_path():
    url = os.environ.get('DATABASE_URL', '')
    if url.startswith('sqlite:///'):
        return url[len('sqlite:///'):]
    return os.path.join(os.path.dirname(__file__), '..', 'vendorcompare.db')

DB_PATH = _db_path()


def up():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(prices)")
    cols = [row[1] for row in cur.fetchall()]
    if "is_manual" not in cols:
        cur.execute("ALTER TABLE prices ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT 0")
        conn.commit()
        print("[migrate_012a] Added is_manual to prices")
    else:
        print("[migrate_012a] is_manual already exists, skipping")
    conn.close()


def down():
    """
    Down migration: remove is_manual from prices.
    SQLite does not support DROP COLUMN (< 3.35). We recreate the table.
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(prices)")
    cols = [row[1] for row in cur.fetchall()]
    if "is_manual" not in cols:
        print("[migrate_012a] is_manual not found, nothing to roll back")
        conn.close()
        return
    cur.executescript("""
        BEGIN;
        CREATE TABLE prices_backup AS
            SELECT id, product_id, vendor_id, price, unit, updated_at FROM prices;
        DROP TABLE prices;
        ALTER TABLE prices_backup RENAME TO prices;
        COMMIT;
    """)
    print("[migrate_012a] Down: removed is_manual from prices")
    conn.close()


if __name__ == "__main__":
    up()
