"""
/api/chat/history — Chat history persistence endpoints.
Fetch previous conversations and clear history.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..auth_deps import get_current_role
from ..models import ChatMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])


class HistoryMessage(BaseModel):
    role: str
    content: str
    created_at: str


class HistoryResponse(BaseModel):
    messages: list[HistoryMessage]


@router.get("/history")
async def get_chat_history(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    """
    Get the last 100 chat messages, ordered by created_at ASC.
    Requires authentication.
    """
    try:
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.location_id == 1)
            .order_by(ChatMessage.created_at.asc())
            .limit(100)
            .all()
        )

        return HistoryResponse(
            messages=[
                HistoryMessage(
                    role=m.role,
                    content=m.content,
                    created_at=m.created_at.isoformat() if m.created_at else "",
                )
                for m in messages
            ]
        )
    except Exception:
        # Fail silently on DB error
        return HistoryResponse(messages=[])


@router.delete("/history")
async def clear_chat_history(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    """
    Clear all chat history for location_id=1.
    Requires admin role.
    """
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    try:
        count = db.query(ChatMessage).filter(ChatMessage.location_id == 1).delete()
        db.commit()
        return {"cleared": count}
    except Exception:
        db.rollback()
        return {"cleared": 0}
