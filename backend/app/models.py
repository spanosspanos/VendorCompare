from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .database import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    orders = relationship("Order", back_populates="location")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    sort_order = Column(Integer, nullable=False, default=0)

    products = relationship("Product", back_populates="category")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    contact_email = Column(String)
    phone = Column(String)
    display_name = Column(String, nullable=True)
    connection_type = Column(String, nullable=False, default="manual")
    is_muted = Column(Boolean, nullable=False, default=False)
    is_deleted = Column(Boolean, nullable=False, default=False)

    prices = relationship("Price", back_populates="vendor")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    unit = Column(String, default="each")
    sort_order = Column(Integer, nullable=False, default=0)

    muted = Column(Boolean, nullable=False, default=False)
    is_deleted = Column(Boolean, nullable=False, default=False)
    needs_pricing = Column(Boolean, nullable=False, default=False)

    category = relationship("Category", back_populates="products")
    prices = relationship("Price", back_populates="product")


class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    price = Column(Float, nullable=False)
    unit = Column(String)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    is_manual = Column(Boolean, nullable=False, default=False)

    product = relationship("Product", back_populates="prices")
    vendor = relationship("Vendor", back_populates="prices")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    status = Column(String, default="saved")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    total_cost = Column(Float, nullable=False, default=0.0)
    savings_vs_worst = Column(Float, nullable=False, default=0.0)
    notes_to_john = Column(Text, nullable=True)
    requires_review = Column(Boolean, nullable=False, default=False)
    review_status = Column(String, nullable=False, default='not_required')
    review_note = Column(Text, nullable=True)
    taco_flag_count = Column(Integer, nullable=False, default=0)
    comparison_json = Column(Text, nullable=True)

    location = relationship("Location", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")
    vendor_splits = relationship("OrderVendorSplit", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    selected_vendor_id = Column(Integer, ForeignKey("vendors.id"))
    unit_price = Column(Float, nullable=False, default=0.0)
    line_total = Column(Float, nullable=False, default=0.0)
    item_note = Column(Text, nullable=True)
    flag = Column(String, nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    selected_vendor = relationship("Vendor")


class OrderVendorSplit(Base):
    __tablename__ = "order_vendor_splits"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    total = Column(Float, default=0.0)

    order = relationship("Order", back_populates="vendor_splits")
    vendor = relationship("Vendor")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    old_price = Column(Float, nullable=True)
    new_price = Column(Float, nullable=False)
    source = Column(String, default="upload")  # "scraper" | "upload"

    vendor = relationship("Vendor")
    product = relationship("Product")


class ParSetting(Base):
    __tablename__ = "par_settings"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    par_value = Column(Integer, nullable=False, default=0)
    locked_vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    product = relationship("Product")
    location = relationship("Location")
    locked_vendor = relationship("Vendor")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    hashed_pin = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'admin'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class VendorDocument(Base):
    __tablename__ = "vendor_documents"
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    uploaded_by = Column(String, nullable=False)  # employee name from JWT
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    item_count = Column(Integer, nullable=False, default=0)
    is_most_recent = Column(Boolean, nullable=False, default=True)

    vendor = relationship("Vendor")
    archive_items = relationship("VendorArchiveItem", back_populates="document", cascade="all, delete-orphan")


class VendorArchiveItem(Base):
    __tablename__ = "vendor_archive_items"
    id = Column(Integer, primary_key=True, index=True)
    vendor_doc_id = Column(Integer, ForeignKey("vendor_documents.id"), nullable=False)
    sku = Column(String, nullable=True)
    description = Column(String, nullable=False)
    price = Column(Float, nullable=True)
    unit = Column(String, nullable=True)

    document = relationship("VendorDocument", back_populates="archive_items")
