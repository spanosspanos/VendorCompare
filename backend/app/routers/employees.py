"""Employee management routes — admin only.
Prefix: /api/employees
"""
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Employee
from ..auth_deps import get_current_role, require_admin

router = APIRouter(tags=["employees"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class EmployeeOut(BaseModel):
    id: int
    name: str
    role: str

    class Config:
        from_attributes = True


class CreateEmployeeRequest(BaseModel):
    name: str
    pin: str
    role: str  # 'admin' or 'user'

    @field_validator("pin")
    @classmethod
    def pin_length(cls, v):
        if not v.isdigit() or not (4 <= len(v) <= 6):
            raise ValueError("PIN must be 4–6 digits")
        return v

    @field_validator("role")
    @classmethod
    def role_valid(cls, v):
        if v not in ("admin", "user"):
            raise ValueError("Role must be 'admin' or 'user'")
        return v


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[EmployeeOut])
def list_employees(db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_admin(role)
    return db.query(Employee).order_by(Employee.id).all()


@router.post("/", response_model=EmployeeOut, status_code=201)
def create_employee(
    req: CreateEmployeeRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)

    # Check for duplicate PIN
    existing = db.query(Employee).all()
    for emp in existing:
        if bcrypt.checkpw(req.pin.encode(), emp.hashed_pin.encode()):
            raise HTTPException(status_code=409, detail="PIN already in use")

    hashed = bcrypt.hashpw(req.pin.encode(), bcrypt.gensalt()).decode()
    new_emp = Employee(name=req.name, hashed_pin=hashed, role=req.role)
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp


class PatchEmployeeRequest(BaseModel):
    name: Optional[str] = None
    pin: Optional[str] = None
    role: Optional[str] = None


@router.patch("/{employee_id}", response_model=EmployeeOut)
def patch_employee(
    employee_id: int,
    req: PatchEmployeeRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if req.name is not None and req.name.strip():
        emp.name = req.name.strip()

    if req.pin is not None and req.pin.strip():
        if not req.pin.isdigit() or not (4 <= len(req.pin) <= 6):
            raise HTTPException(status_code=400, detail="PIN must be 4–6 digits")
        all_emps = db.query(Employee).filter(Employee.id != employee_id).all()
        for other in all_emps:
            if bcrypt.checkpw(req.pin.encode(), other.hashed_pin.encode()):
                raise HTTPException(status_code=409, detail="PIN already in use")
        emp.hashed_pin = bcrypt.hashpw(req.pin.encode(), bcrypt.gensalt()).decode()

    if req.role is not None:
        if req.role not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="Invalid role")
        if employee_id == 1 and req.role != "admin":
            raise HTTPException(status_code=403, detail="Cannot demote the seeded admin")
        emp.role = req.role

    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)

    # Guard: never allow deleting the seeded admin (id=1)
    if employee_id == 1:
        raise HTTPException(status_code=403, detail="Cannot delete the seeded admin")

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    db.delete(emp)
    db.commit()
