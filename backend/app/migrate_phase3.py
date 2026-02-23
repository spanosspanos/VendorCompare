"""
Phase 3 migration: add total_cost, savings_vs_worst to orders,
and unit_price, line_total to order_items.

Idempotent — safe to run multiple times.
"""
import sqlite3
import os

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./vendorcompare.db").replace("sqlite:///", "")


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    migrations = [
        ("orders", "total_cost", "ALTER TABLE orders ADD COLUMN total_cost REAL NOT NULL DEFAULT 0.0"),
        ("orders", "savings_vs_worst", "ALTER TABLE orders ADD COLUMN savings_vs_worst REAL NOT NULL DEFAULT 0.0"),
        ("order_items", "unit_price", "ALTER TABLE order_items ADD COLUMN unit_price REAL NOT NULL DEFAULT 0.0"),
        ("order_items", "line_total", "ALTER TABLE order_items ADD COLUMN line_total REAL NOT NULL DEFAULT 0.0"),
    ]

    for table, column, sql in migrations:
        if not column_exists(cur, table, column):
            print(f"Adding {table}.{column}...")
            cur.execute(sql)
            conn.commit()
        else:
            print(f"Column {table}.{column} already exists — skipping")

    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    run()
