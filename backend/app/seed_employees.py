"""Seed admin employee for Phase 012A bootstrap"""
import bcrypt
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import Employee

ADMIN_PIN = "098765"
ADMIN_NAME = "SpanosspanoS"


def seed_employees(db: Session):
    existing = db.query(Employee).filter(Employee.name == ADMIN_NAME).first()
    if existing:
        print(f"[seed_employees] {ADMIN_NAME} already seeded, skipping")
        return
    hashed = bcrypt.hashpw(ADMIN_PIN.encode(), bcrypt.gensalt()).decode()
    emp = Employee(name=ADMIN_NAME, hashed_pin=hashed, role="admin")
    db.add(emp)
    db.commit()
    print(f"[seed_employees] Seeded admin employee: {ADMIN_NAME}")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_employees(db)
    finally:
        db.close()
