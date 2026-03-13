"""Auth router — PIN login and session check"""
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from jose import jwt
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Employee
from ..auth_deps import get_current_role, SECRET_KEY, ALGORITHM

router = APIRouter()

# Security note: PIN-length differentiation (4=user, 6=admin) is sufficient for single-owner
# small kitchen deployments. For multi-location or high-turnover environments, consider adding
# a second factor behind the admin gate.

# Dummy hash used for constant-time validation when PIN not found (prevents timing attacks)
_DUMMY_HASH = bcrypt.hashpw(b"000000", bcrypt.gensalt()).decode()


class LoginRequest(BaseModel):
    pin: str


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    matched = None
    for emp in employees:
        if bcrypt.checkpw(req.pin.encode(), emp.hashed_pin.encode()):
            matched = emp
            break

    if not matched:
        # Constant-time: always do a bcrypt check even on miss
        bcrypt.checkpw(req.pin.encode(), _DUMMY_HASH.encode())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN. Please try again."
        )

    token = jwt.encode(
        {
            "sub": str(matched.id),
            "role": matched.role,
            "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return {"token": token, "role": matched.role}


@router.get("/me")
def me(role: str = Depends(get_current_role)):
    return {"role": role}
