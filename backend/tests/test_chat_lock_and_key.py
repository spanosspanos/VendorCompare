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


def assert_envelope_shape(envelope):
    assert set(envelope) == {"ok", "verb", "entity", "id", "observed", "expected", "invariants", "match"}
    assert envelope["ok"] is True
    assert envelope["match"] is True
    assert isinstance(envelope["observed"], dict)
    assert isinstance(envelope["expected"], dict)
    assert isinstance(envelope["invariants"], list)


def test_keyway_readback_envelope_shape(db):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    saved = chat.execute_tool("save_order", {"draft_id": assembled["draft_id"], "origin_route": "chat"}, db)
    assert_envelope_shape(saved)
    assert saved["verb"] == "save_order"
    assert saved["entity"] == "Order"


def test_tumblers_double_save_yields_exactly_one_order(db):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    draft_id = assembled["draft_id"]
    assert db.query(OrderDraft).filter(OrderDraft.id == draft_id).count() == 1

    first = chat.execute_tool("save_order", {"draft_id": draft_id, "origin_route": "chat"}, db)
    with pytest.raises(chat.ReadbackMismatch):
        chat.execute_tool("save_order", {"draft_id": draft_id, "origin_route": "chat"}, db)

    assert first["match"] is True
    assert db.query(Order).count() == 1


def test_shear_line_readback_is_post_commit_and_falsifiable(db, monkeypatch):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    saved = chat.execute_tool("save_order", {"draft_id": assembled["draft_id"], "origin_route": "chat"}, db)
    assert_envelope_shape(saved)
    assert saved["observed"]["total_cost"] == 20.0

    original = chat._post_commit_readback
    def divergent(*args, **kwargs):
        envelope = original(*args, **kwargs)
        envelope["match"] = False
        raise chat.ReadbackMismatch(envelope)
    monkeypatch.setattr(chat, "_post_commit_readback", divergent)
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    with pytest.raises(chat.ReadbackMismatch):
        chat.execute_tool("save_order", {"draft_id": assembled["draft_id"], "origin_route": "chat"}, db)


def test_readback_failure_rolls_back_no_phantom_order(db, monkeypatch):
    assembled = chat._tool_assemble_order([{"product_id": 1, "quantity": 2}], db)
    draft_id = assembled["draft_id"]
    monkeypatch.setattr(chat, "_save_order_precommit_guard", lambda *a, **k: False)

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
