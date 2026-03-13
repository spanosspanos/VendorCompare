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
    muted: bool = False
    is_deleted: bool = False
    needs_pricing: bool = False
    par_value: Optional[int] = None

    model_config = {"from_attributes": True}


class ProductPatchIn(BaseModel):
    name: Optional[str] = None
    muted: Optional[bool] = None
    is_deleted: Optional[bool] = None


class ProductCreateIn(BaseModel):
    name: str
    category_id: int
    needs_pricing: bool = False


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
    is_manual: bool = False

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
    # quantity/selected_vendor_id/unit_price/line_total are Optional to support
    # taco-flagged NoPar items that have no PAR, no vendor, no price (Fix A, Case 2).
    product_id: int
    quantity: Optional[int] = None
    selected_vendor_id: Optional[int] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
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
    comparison: Optional[dict] = None


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
    review_note: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderDetailLineItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    selected_vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
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
    review_note: Optional[str] = None
    taco_flag_count: int = 0
    comparison: Optional[dict] = None


class SpendSummaryOut(BaseModel):
    total_spent: float
    total_saved: float
    order_count: int
    period: str


# --- PAR Settings schemas ---

class ParSettingOut(BaseModel):
    product_id: int
    par_value: int
    locked_vendor_id: Optional[int] = None
    model_config = {"from_attributes": True}


class VendorPriceSummary(BaseModel):
    vendor_id: int
    vendor_name: str
    price: float
    is_manual: bool = False


class ParSettingWithPricesOut(BaseModel):
    product_id: int
    product_name: str
    category_id: Optional[int] = None
    par_value: Optional[int] = None
    locked_vendor_id: Optional[int] = None
    cheapest_price: Optional[float] = None
    cheapest_vendor_id: Optional[int] = None
    cheapest_vendor_name: Optional[str] = None
    cheapest_is_manual: bool = False
    unit: Optional[str] = None
    available_vendors: List[VendorPriceSummary] = []
    muted: bool = False
    is_deleted: bool = False


class VendorLockIn(BaseModel):
    locked_vendor_id: Optional[int] = None


class PriceUpdateIn(BaseModel):
    price: float
    unit: Optional[str] = None


class ParSettingIn(BaseModel):
    par_value: int


class OrderReviewIn(BaseModel):
    review_status: str
    review_note: Optional[str] = None


class PatchOrderIn(BaseModel):
    review_status: Optional[str] = None
    review_note: Optional[str] = None
    items: Optional[List[SaveOrderItemIn]] = None
    vendor_splits: Optional[List[SaveOrderVendorSplitIn]] = None
    total_cost: Optional[float] = None
    savings_vs_worst: Optional[float] = None
