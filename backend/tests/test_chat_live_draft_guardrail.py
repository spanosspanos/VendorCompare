import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.database import Base
from app.models import Location
from app.routers import chat


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    session.add(Location(id=1, name="White Plains"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def _chat_response(message, db):
    request = chat.ChatRequest(messages=[chat.ChatMessage(role="user", content=message)])
    return asyncio.run(chat.chat(request=request, db=db, role="ordering"))


def _stub_completion(content, finish_reason="stop"):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(content=content, role="assistant", tool_calls=None),
            )
        ]
    )


def test_order_request_helper_catches_quantity_product_phrase():
    assert chat._looks_like_order_request("I need 2 limes") is True
    assert chat._looks_like_order_request("2 limes") is True
    assert chat._looks_like_order_request("add 3 cases tortillas") is True
    assert chat._looks_like_order_request("hello") is False


def test_save_confirmation_helper_catches_save_it():
    assert chat._looks_like_save_confirmation("save it") is True
    assert chat._looks_like_save_confirmation("looks good, save that") is True


def test_stop_without_draft_for_order_request_returns_safe_no_draft_response(db, monkeypatch):
    fabricated = "Sure — I saved 2 limes from Food Direct for $12.00."
    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion(fabricated),
    )

    payload = _chat_response("I need 2 limes", db)
    assert payload["reply"] == chat._safe_no_draft_reply()
    assert payload["order_data"] is None
    assert payload["confirmation_receipt"] is None
    assert "saved 2 limes" not in payload["reply"]


def test_stop_without_draft_for_save_confirmation_returns_safe_no_draft_response(db, monkeypatch):
    fabricated = "Order saved. It's in the review queue."
    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion(fabricated),
    )

    payload = _chat_response("save it", db)
    assert payload["reply"] == chat._safe_no_draft_reply()
    assert payload["order_data"] is None
    assert payload["confirmation_receipt"] is None
    assert payload["reply"] != fabricated


def test_stop_without_draft_for_non_order_conversation_preserves_model_reply(db, monkeypatch):
    normal_reply = "I can help with VendorCompare ordering."
    monkeypatch.setattr(
        chat.client.chat.completions,
        "create",
        lambda **kwargs: _stub_completion(normal_reply),
    )

    payload = _chat_response("hello", db)

    assert payload["reply"] == normal_reply
