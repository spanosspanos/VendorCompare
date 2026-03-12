"""
Migration: add audit_log table for Phase 8b Price Layer.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from app.models import Base, AuditLog
import sqlalchemy as sa

def run():
    inspector = sa.inspect(engine)
    if "audit_log" not in inspector.get_table_names():
        AuditLog.__table__.create(bind=engine)
        print("Created table: audit_log")
    else:
        print("Table audit_log already exists — skipping.")

if __name__ == "__main__":
    run()
