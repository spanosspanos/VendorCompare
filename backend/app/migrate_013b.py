"""
migrate_013b.py — Recovery Code (Skeleton Key) migration

Creates recovery_codes table if not exists, generates initial recovery code,
hashes it, inserts into DB, and prints the plaintext code to stdout.

Run once on the server:
    docker compose exec backend python -m app.migrate_013b
"""
import secrets
from datetime import datetime, timezone
from sqlalchemy import text
from passlib.context import CryptContext

from .database import engine, SessionLocal
from .models import Base, RecoveryCode

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def up():
    # Create recovery_codes table if not exists
    Base.metadata.create_all(bind=engine, tables=[RecoveryCode.__table__])

    db = SessionLocal()
    try:
        existing = db.query(RecoveryCode).first()
        if existing:
            print("[migrate_013b] Recovery code already exists — skipping generation.")
            print("[migrate_013b] To rotate, use the /api/auth/recover endpoint.")
            return

        # Generate random 8-digit code (10000000–99999999)
        plaintext_code = str(secrets.randbelow(90000000) + 10000000)
        hashed = pwd_context.hash(plaintext_code)

        record = RecoveryCode(
            hashed_code=hashed,
            hint_prefix=plaintext_code[:4],
            created_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.commit()

        print(f"\n{'='*50}")
        print(f"  RECOVERY CODE (write this down!): {plaintext_code}")
        print(f"{'='*50}\n")
        print("[migrate_013b] Recovery code created and stored.")
    finally:
        db.close()


if __name__ == "__main__":
    up()
