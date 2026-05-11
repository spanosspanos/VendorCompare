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

    # Add columns to vendors
    existing = {row[1] for row in cur.execute("PRAGMA table_info(vendors)")}
    if "display_name" not in existing:
        cur.execute("ALTER TABLE vendors ADD COLUMN display_name TEXT")
    if "connection_type" not in existing:
        cur.execute("ALTER TABLE vendors ADD COLUMN connection_type TEXT NOT NULL DEFAULT 'manual'")
    if "is_muted" not in existing:
        cur.execute("ALTER TABLE vendors ADD COLUMN is_muted INTEGER NOT NULL DEFAULT 0")
    if "is_deleted" not in existing:
        cur.execute("ALTER TABLE vendors ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")

    # Set Food Direct connection_type to "docs"
    cur.execute("UPDATE vendors SET connection_type = 'docs' WHERE name = 'Food Direct' AND connection_type = 'manual'")

    # Create vendor_documents table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS vendor_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL REFERENCES vendors(id),
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            item_count INTEGER NOT NULL DEFAULT 0,
            is_most_recent INTEGER NOT NULL DEFAULT 1
        )
    """)

    # Create vendor_archive_items table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS vendor_archive_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_doc_id INTEGER NOT NULL REFERENCES vendor_documents(id),
            sku TEXT,
            description TEXT NOT NULL,
            price REAL,
            unit TEXT
        )
    """)

    conn.commit()
    conn.close()


def down():
    # Down migration: cannot easily remove columns in SQLite; just note
    pass


if __name__ == "__main__":
    up()
    print("Migration 012c applied.")
