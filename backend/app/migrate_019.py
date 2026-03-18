"""Migration 019 — device_tokens table"""
from .database import engine
from sqlalchemy import text


def up():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS device_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT (datetime('now'))
            )
        """))
        conn.commit()
    print("Migration 019: device_tokens table ready.")


if __name__ == "__main__":
    up()
