from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Category, Product
from ..schemas import CategoryWithProductsOut

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[CategoryWithProductsOut])
def get_products(
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Category).order_by(Category.sort_order)

    if category_id is not None:
        query = query.filter(Category.id == category_id)

    categories = query.all()

    result = []
    for cat in categories:
        products = (
            db.query(Product)
            .filter(Product.category_id == cat.id)
            .order_by(Product.sort_order)
            .all()
        )
        result.append(
            CategoryWithProductsOut(
                id=cat.id,
                name=cat.name,
                sort_order=cat.sort_order,
                products=products,
            )
        )
    return result
