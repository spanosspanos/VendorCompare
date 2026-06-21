import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.database import Base
from app.models import Location, Category, Product, Vendor, Price, Order, OrderDraft
from app.routers import chat


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    session.add(Location(id=1, name="White Plains"))
    session.add(Category(id=1, name="Produce", sort_order=1))
    session.add(Vendor(id=1, name="Food Direct", is_muted=False, is_deleted=False))
    session.add(Vendor(id=2, name="US Foods", is_muted=False, is_deleted=False))
    session.add(Product(id=1, name="Limes", category_id=1, unit="case"))
    session.add(Price(product_id=1, vendor_id=1, price=10.0, unit="case"))
    session.add(Price(product_id=1, vendor_id=2, price=12.0, unit="case"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def assert_receipt_shape(receipt):
    assert set(receipt) == {
        "order_id", "status", "review_status", "created_at", "total_cost",
        "savings_vs_worst", "item_count", "vendor_splits",
    }
    assert isinstance(receipt["order_id"], int)
    assert receipt["status"] == "saved"
    assert receipt["review_status"] == "pending"
    assert isinstance(receipt["created_at"], str)
    assert isinstance(receipt["total_cost"], float)
    assert isinstance(receipt["savings_vs_worst"], float)
    assert isinstance(receipt["item_count"], int)
    assert isinstance(receipt["vendor_splits"], list)
    assert isinstance(receipt["vendor_splits"][0]["vendor"], str)
    assert isinstance(receipt["vendor_splits"][0]["total"], float)


def test_keyway_confirmation_receipt_shape(db):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    saved = chat._tool_save_order(assembled["draft_id"], "chat", db)
    assert saved["status"] == "saved"
    assert_receipt_shape(saved["confirmation_receipt"])


def test_tumblers_double_save_yields_exactly_one_order(db):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    draft_id = assembled["draft_id"]
    assert db.query(OrderDraft).filter(OrderDraft.id == draft_id).count() == 1

    first = chat._tool_save_order(draft_id, "chat", db)
    second = chat._tool_save_order(draft_id, "chat", db)

    assert first["status"] == "saved"
    assert second["status"] == "not_saved"
    assert db.query(Order).count() == 1


def test_shear_line_readback_match_and_mismatch(db):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    saved = chat._tool_save_order(assembled["draft_id"], "chat", db)
    order_id = saved["confirmation_receipt"]["order_id"]

    match = chat._readback_confirmation(order_id, expected_total=20.0, expected_item_count=1, db=db)
    mismatch_total = chat._readback_confirmation(order_id, expected_total=999.0, expected_item_count=1, db=db)
    mismatch_count = chat._readback_confirmation(order_id, expected_total=20.0, expected_item_count=99, db=db)

    assert match is not None
    assert_receipt_shape(match)
    assert mismatch_total is None
    assert mismatch_count is None


def test_readback_failure_rolls_back_no_phantom_order(db, monkeypatch):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    draft_id = assembled["draft_id"]
    monkeypatch.setattr(chat, "_readback_confirmation", lambda *a, **k: None)

    result = chat._tool_save_order(draft_id, "chat", db)

    assert result["status"] == "not_saved"
    assert db.query(Order).count() == 0
    draft = db.query(OrderDraft).filter(OrderDraft.id == draft_id).first()
    assert draft is not None
    assert draft.consumed_at is None


def test_expired_draft_rejected_without_order(db):
    payload = chat._assemble_order_payload([{"product_id": 1, "quantity": 1}], db)
    draft = OrderDraft(
        id="expired",
        location_id=1,
        payload_json=json.dumps(payload),
        total_cost=payload["total_cost"],
        savings_vs_worst=payload["savings_vs_worst"],
        item_count=1,
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db.add(draft)
    db.commit()

    result = chat._tool_save_order("expired", "chat", db)
    assert result["status"] == "not_saved"
    assert db.query(Order).count() == 0
