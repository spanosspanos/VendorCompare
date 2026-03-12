from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from ..database import get_db
from ..models import Category, Product
from ..schemas import CategoryWithProductsOut, ProductOut, ProductPatchIn, ProductCreateIn

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[CategoryWithProductsOut])
def get_products(
    category_id: Optional[int] = Query(None),
    manage: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(Category).order_by(Category.sort_order)

    if category_id is not None:
        query = query.filter(Category.id == category_id)

    categories = query.all()

    result = []
    for cat in categories:
        pq = (
            db.query(Product)
            .filter(Product.category_id == cat.id)
            .order_by(Product.sort_order)
        )
        if not manage:
            pq = pq.filter(Product.muted == False, Product.is_deleted == False)
        products = pq.all()
        result.append(
            CategoryWithProductsOut(
                id=cat.id,
                name=cat.name,
                sort_order=cat.sort_order,
                products=products,
            )
        )
    return result


@router.post("/", response_model=ProductOut)
def create_product(
    body: ProductCreateIn,
    db: Session = Depends(get_db),
):
    category = db.query(Category).filter(Category.id == body.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    max_sort = db.query(func.max(Product.sort_order)).filter(
        Product.category_id == body.category_id
    ).scalar()
    sort_order = (max_sort + 1) if max_sort is not None else 0

    product = Product(
        name=body.name,
        category_id=body.category_id,
        needs_pricing=body.needs_pricing,
        sort_order=sort_order,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{id}", response_model=ProductOut)
def patch_product(
    id: int,
    body: ProductPatchIn,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if body.name is not None:
        product.name = body.name
    if body.muted is not None:
        product.muted = body.muted
    if body.is_deleted is not None:
        product.is_deleted = body.is_deleted

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{id}")
def delete_product(
    id: int,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"ok": True}
