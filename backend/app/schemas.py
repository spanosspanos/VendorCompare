from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class VendorOut(BaseModel):
    id: int
    name: str
    contact_email: Optional[str] = None
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: int
    name: str
    category_id: int
    unit: str
    sort_order: int

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: int
    name: str
    sort_order: int
    product_count: int = 0

    model_config = {"from_attributes": True}


class CategoryWithProductsOut(BaseModel):
    id: int
    name: str
    sort_order: int
    products: list[ProductOut] = []

    model_config = {"from_attributes": True}


# --- Price schemas ---

class PriceOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    vendor_id: int
    vendor_name: str
    unit_price: float
    unit: Optional[str] = None
    effective_date: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Order Assembly schemas ---

class OrderItemIn(BaseModel):
    product_id: int
    quantity: int


class AssembleOrderIn(BaseModel):
    location_id: int
    items: list[OrderItemIn]


class AssembledLineItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    unit: Optional[str] = None
    line_total: float


class VendorOrder(BaseModel):
    vendor_id: int
    vendor_name: str
    items: list[AssembledLineItem]
    subtotal: float


class VendorComparison(BaseModel):
    vendor_id: int
    vendor_name: str
    total_if_all: Optional[float] = None
    items_carried: int
    items_selected: int


class ComparisonData(BaseModel):
    vendors: list[VendorComparison]
    savings_vs_worst: float


class UnpricedItem(BaseModel):
    product_id: int
    product_name: str


class AssembleOrderOut(BaseModel):
    vendor_orders: list[VendorOrder]
    total_cost: float
    unpriced_items: list[UnpricedItem]
    comparison: ComparisonData


# --- Phase 3: Save Order schemas ---

class SaveOrderItemIn(BaseModel):
    product_id: int
    quantity: int
    selected_vendor_id: int
    unit_price: float
    line_total: float
    item_note: Optional[str] = None
    flag: Optional[str] = None


class SaveOrderVendorSplitIn(BaseModel):
    vendor_id: int
    total: float


class SaveOrderIn(BaseModel):
    location_id: int
    total_cost: float
    savings_vs_worst: float
    items: list[SaveOrderItemIn]
    vendor_splits: list[SaveOrderVendorSplitIn]
    notes_to_john: Optional[str] = None
    requires_review: bool = False
    taco_flag_count: int = 0


class OrderListItem(BaseModel):
    id: int
    created_at: datetime
    total_cost: float
    savings_vs_worst: float
    item_count: int
    vendor_count: int
    status: str
    requires_review: bool = False
    review_status: str = 'not_required'

    model_config = {"from_attributes": True}


class OrderDetailLineItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    selected_vendor_id: int
    vendor_name: str
    unit_price: float
    line_total: float
    item_note: Optional[str] = None
    flag: Optional[str] = None


class OrderDetailVendorSplit(BaseModel):
    vendor_id: int
    vendor_name: str
    total: float


class OrderDetailOut(BaseModel):
    id: int
    created_at: datetime
    status: str
    total_cost: float
    savings_vs_worst: float
    items: list[OrderDetailLineItem]
    vendor_splits: list[OrderDetailVendorSplit]
    notes_to_john: Optional[str] = None
    requires_review: bool = False
    review_status: str = 'not_required'
    taco_flag_count: int = 0


class SpendSummaryOut(BaseModel):
    total_spent: float
    total_saved: float
    order_count: int
    period: str


# --- PAR Settings schemas ---

class ParSettingOut(BaseModel):
    product_id: int
    par_value: int
    model_config = {"from_attributes": True}


class ParSettingIn(BaseModel):
    par_value: int


class OrderReviewIn(BaseModel):
    review_status: str  # 'approved'
