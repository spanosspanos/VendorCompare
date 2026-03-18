"""Auth router — PIN login and session check"""
import os
import uuid
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from jose import jwt
from sqlalchemy import text
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
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
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

    # Generate and persist device token
    device_token = str(uuid.uuid4())
    db.execute(
        text("INSERT OR IGNORE INTO device_tokens (token) VALUES (:token)"),
        {"token": device_token},
    )
    db.commit()

    response.set_cookie(
        key="device_token",
        value=device_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=31536000,
        path="/vendorcompare",
    )

    return {"token": token, "role": matched.role}


@router.get("/check-device")
def check_device(request: Request, db: Session = Depends(get_db)):
    device_token = request.cookies.get("device_token")
    if device_token:
        row = db.execute(
            text("SELECT id FROM device_tokens WHERE token = :token"),
            {"token": device_token},
        ).fetchone()
        if row:
            return {"recognized": True}
    return {"recognized": False}


@router.get("/me")
def me(role: str = Depends(get_current_role)):
    return {"role": role}
