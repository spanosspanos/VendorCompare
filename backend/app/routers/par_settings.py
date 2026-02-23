from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ParSetting
from ..schemas import ParSettingOut, ParSettingIn

router = APIRouter()


@router.get("/", response_model=list[ParSettingOut])
def list_par_settings(location_id: int = 1, db: Session = Depends(get_db)):
    """List all PAR settings for a location."""
    settings = db.query(ParSetting).filter(ParSetting.location_id == location_id).all()
    return settings


@router.put("/{product_id}", response_model=ParSettingOut)
def upsert_par_setting(
    product_id: int,
    payload: ParSettingIn,
    location_id: int = 1,
    db: Session = Depends(get_db),
):
    """Upsert PAR value for a product+location."""
    existing = (
        db.query(ParSetting)
        .filter(
            ParSetting.product_id == product_id,
            ParSetting.location_id == location_id,
        )
        .first()
    )
    if existing:
        existing.par_value = payload.par_value
        db.commit()
        db.refresh(existing)
        return existing
    else:
        setting = ParSetting(
            product_id=product_id,
            location_id=location_id,
            par_value=payload.par_value,
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting
