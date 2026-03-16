"""Recovery router — Skeleton Key (recovery code) endpoints"""
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Employee, RecoveryCode
from ..auth_deps import get_current_role

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RecoverRequest(BaseModel):
    recovery_code: str
    new_pin: str


@router.post("/recover")
def recover(req: RecoverRequest, db: Session = Depends(get_db)):
    """Reset all admin PINs using the recovery code. Rotates the recovery code on success."""
    record = db.query(RecoveryCode).first()
    if not record:
        raise HTTPException(status_code=400, detail="No recovery code configured. Run migration first.")

    if not pwd_context.verify(req.recovery_code, record.hashed_code):
        raise HTTPException(status_code=400, detail="Invalid recovery code.")

    # Reset all admin employees' PINs
    new_hashed_pin = pwd_context.hash(req.new_pin)
    admins = db.query(Employee).filter(Employee.role == "admin").all()
    for emp in admins:
        emp.hashed_pin = new_hashed_pin

    # Rotate recovery code
    new_plaintext = str(secrets.randbelow(90000000) + 10000000)
    new_hashed_recovery = pwd_context.hash(new_plaintext)
    record.hashed_code = new_hashed_recovery
    record.hint_prefix = new_plaintext[:4]
    record.plaintext_code = new_plaintext
    record.last_used_at = datetime.now(timezone.utc)

    db.commit()

    return {"message": "PIN reset", "new_recovery_code": new_plaintext}


@router.get("/recovery-code-hint")
def recovery_code_hint(db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    """Admin-only: returns first 4 digits of recovery code masked like '1234****'."""
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")

    record = db.query(RecoveryCode).first()
    if not record:
        raise HTTPException(status_code=404, detail="No recovery code configured.")

    full_code = record.plaintext_code or f"{record.hint_prefix or '????'}****"
    return {"full_code": full_code}
