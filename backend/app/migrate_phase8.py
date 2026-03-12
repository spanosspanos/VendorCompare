"""Phase 8 migration: add locked_vendor_id to par_settings table."""
from sqlalchemy import text
from .database import engine


def run():
    with engine.connect() as conn:
        # Check existing columns (SQLite compatible)
        result = conn.execute(text("PRAGMA table_info(par_settings)"))
        columns = [row[1] for row in result.fetchall()]
        if "locked_vendor_id" in columns:
            print("Column locked_vendor_id already exists in par_settings — skipping.")
            return

        conn.execute(text(
            "ALTER TABLE par_settings ADD COLUMN locked_vendor_id INTEGER REFERENCES vendors(id)"
        ))
        conn.commit()
        print("Migration complete: added locked_vendor_id to par_settings.")


if __name__ == "__main__":
    run()
