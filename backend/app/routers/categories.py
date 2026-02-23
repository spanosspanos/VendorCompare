from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Category, Product
from ..schemas import CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    results = (
        db.query(
            Category.id,
            Category.name,
            Category.sort_order,
            func.count(Product.id).label("product_count"),
        )
        .outerjoin(Product)
        .group_by(Category.id)
        .order_by(Category.sort_order)
        .all()
    )
    return [
        CategoryOut(
            id=r.id,
            name=r.name,
            sort_order=r.sort_order,
            product_count=r.product_count,
        )
        for r in results
    ]
