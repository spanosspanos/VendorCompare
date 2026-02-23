from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Vendor
from ..schemas import VendorOut

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


@router.get("", response_model=list[VendorOut])
def get_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).all()
