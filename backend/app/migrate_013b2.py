"""
migrate_013b2.py — Backfill plaintext_code column for RecoveryCode table
Adds plaintext_code column if missing, backfills existing record.
"""
from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import RecoveryCode

def run():
    # Add column if it doesn't exist
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE recovery_codes ADD COLUMN plaintext_code VARCHAR"))
            conn.commit()
            print("[migrate_013b2] Added plaintext_code column.")
        except Exception:
            print("[migrate_013b2] plaintext_code column already exists, skipping.")

    db = SessionLocal()
    try:
        record = db.query(RecoveryCode).first()
        if record and not record.plaintext_code:
            # Backfill with known plaintext code from initial migration
            record.plaintext_code = "78828119"
            db.commit()
            print("[migrate_013b2] Backfilled plaintext_code: 78828119")
        elif record and record.plaintext_code:
            print(f"[migrate_013b2] plaintext_code already set: {record.plaintext_code}")
        else:
            print("[migrate_013b2] No recovery code record found.")
    finally:
        db.close()

if __name__ == "__main__":
    run()
