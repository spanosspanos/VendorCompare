"""Vault router — vendor management, graveyard.
Prefix: /api/vault
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime

from ..database import get_db
from ..models import Vendor, VendorDocument
from ..auth_deps import get_current_role, require_admin

router = APIRouter(prefix="/api/vault", tags=["vault"])


class VendorListItem(BaseModel):
    id: int
    name: str
    display_name: Optional[str]
    connection_type: str
    is_muted: bool
    is_deleted: bool
    doc_count: int
    last_upload_at: Optional[datetime]

    class Config:
        from_attributes = True


class PatchVendorRequest(BaseModel):
    display_name: Optional[str] = None
    connection_type: Optional[str] = None
    is_muted: Optional[bool] = None


class CreateVendorRequest(BaseModel):
    name: str
    connection_type: str = "manual"


@router.get("/vendors", response_model=List[VendorListItem])
def list_vendors(db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_admin(role)
    vendors = db.query(Vendor).filter(Vendor.is_deleted == False).order_by(Vendor.id).all()
    result = []
    for v in vendors:
        docs = db.query(VendorDocument).filter(VendorDocument.vendor_id == v.id).all()
        doc_count = len(docs)
        last_upload = max((d.uploaded_at for d in docs), default=None) if docs else None
        result.append(VendorListItem(
            id=v.id,
            name=v.name,
            display_name=v.display_name,
            connection_type=v.connection_type,
            is_muted=v.is_muted,
            is_deleted=v.is_deleted,
            doc_count=doc_count,
            last_upload_at=last_upload,
        ))
    return result


@router.patch("/vendors/{vendor_id}")
def patch_vendor(
    vendor_id: int,
    req: PatchVendorRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == False).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if req.display_name is not None:
        vendor.display_name = req.display_name if req.display_name.strip() else None
    if req.connection_type is not None:
        if req.connection_type not in ("api", "docs", "manual"):
            raise HTTPException(status_code=400, detail="Invalid connection_type")
        vendor.connection_type = req.connection_type
    if req.is_muted is not None:
        vendor.is_muted = req.is_muted
    db.commit()
    db.refresh(vendor)
    return {"id": vendor.id, "name": vendor.name, "display_name": vendor.display_name,
            "connection_type": vendor.connection_type, "is_muted": vendor.is_muted}


@router.post("/vendors", status_code=201)
def create_vendor(
    req: CreateVendorRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name required")
    existing = db.query(Vendor).filter(Vendor.name == req.name.strip()).first()
    if existing:
        if existing.is_deleted:
            existing.is_deleted = False
            db.commit()
            return {"id": existing.id, "name": existing.name}
        raise HTTPException(status_code=409, detail="Vendor already exists")
    vendor = Vendor(name=req.name.strip(), connection_type=req.connection_type)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return {"id": vendor.id, "name": vendor.name}


@router.delete("/vendors/{vendor_id}", status_code=204)
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == False).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.is_deleted = True
    db.commit()


@router.get("/graveyard")
def list_graveyard(db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_admin(role)
    vendors = db.query(Vendor).filter(Vendor.is_deleted == True).all()
    return [{"id": v.id, "name": v.name, "display_name": v.display_name} for v in vendors]


@router.post("/graveyard/{vendor_id}/restore", status_code=200)
def restore_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_admin(role)
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == True).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found in graveyard")
    vendor.is_deleted = False
    db.commit()
    return {"id": vendor.id, "name": vendor.name}
