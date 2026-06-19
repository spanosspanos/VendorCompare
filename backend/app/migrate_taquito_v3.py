"""
Taquito v3 migration — creates the synonyms table if absent.
Safe to run on existing databases.
"""
from .database import engine


def run():
    with engine.connect() as conn:
        conn.execute(__import__("sqlalchemy").text(
            """
            CREATE TABLE IF NOT EXISTS synonyms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alias TEXT NOT NULL,
                canonical TEXT NOT NULL,
                location_id INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        ))
        conn.execute(__import__("sqlalchemy").text(
            "CREATE INDEX IF NOT EXISTS ix_synonyms_alias ON synonyms (alias)"
        ))
        conn.execute(__import__("sqlalchemy").text(
            "CREATE INDEX IF NOT EXISTS ix_synonyms_location_id ON synonyms (location_id)"
        ))
        conn.commit()
