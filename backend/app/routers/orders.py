import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Price, Product, Vendor, Order, OrderItem, OrderVendorSplit, ParSetting
from ..schemas import (
    AssembleOrderIn,
    AssembleOrderOut,
    AssembledLineItem,
    VendorOrder,
    VendorComparison,
    ComparisonData,
    UnpricedItem,
    SaveOrderIn,
    OrderListItem,
    OrderDetailOut,
    OrderDetailLineItem,
    OrderDetailVendorSplit,
    SpendSummaryOut,
    OrderReviewIn,
)

router = APIRouter()


def _period_filter(query, period: str):
    """Apply date-range filter to an Order query based on period string."""
    now = datetime.now(timezone.utc)
    if period == "month":
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        return query.filter(Order.created_at >= start)
    elif period == "quarter":
        quarter_start_month = ((now.month - 1) // 3) * 3 + 1
        start = datetime(now.year, quarter_start_month, 1, tzinfo=timezone.utc)
        return query.filter(Order.created_at >= start)
    elif period == "year":
        start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
        return query.filter(Order.created_at >= start)
    # "all" or anything else: no filter
    return query


# ── Existing endpoint (keep unchanged) ────────────────────────────────────────

@router.post("/assemble", response_model=AssembleOrderOut)
def assemble_order(payload: AssembleOrderIn, db: Session = Depends(get_db)):
    all_vendors = db.query(Vendor).all()
    vendor_map = {v.id: v.name for v in all_vendors}

    items_selected = len(payload.items)
    unpriced_items = []

    vendor_assignments = {}
    vendor_hypothetical = {v.id: [] for v in all_vendors}
    vendor_items_carried = {v.id: 0 for v in all_vendors}

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            unpriced_items.append(UnpricedItem(
                product_id=item.product_id,
                product_name=f"Unknown product #{item.product_id}",
            ))
            continue

        latest_sub = (
            db.query(
                Price.vendor_id,
                func.max(Price.updated_at).label("max_date"),
            )
            .filter(Price.product_id == item.product_id)
            .group_by(Price.vendor_id)
            .subquery()
        )

        prices = (
            db.query(Price)
            .join(
                latest_sub,
                (Price.vendor_id == latest_sub.c.vendor_id)
                & (Price.updated_at == latest_sub.c.max_date)
                & (Price.product_id == item.product_id),
            )
            .all()
        )

        if not prices:
            unpriced_items.append(UnpricedItem(
                product_id=item.product_id,
                product_name=product.name,
            ))
            continue

        for p in prices:
            line_cost = round(p.price * item.quantity, 2)
            vendor_hypothetical[p.vendor_id].append(line_cost)
            vendor_items_carried[p.vendor_id] += 1

        cheapest = min(prices, key=lambda p: p.price)
        line_total = round(cheapest.price * item.quantity, 2)

        line_item = AssembledLineItem(
            product_id=item.product_id,
            product_name=product.name,
            quantity=item.quantity,
            unit_price=cheapest.price,
            unit=cheapest.unit,
            line_total=line_total,
        )

        if cheapest.vendor_id not in vendor_assignments:
            vendor_assignments[cheapest.vendor_id] = []
        vendor_assignments[cheapest.vendor_id].append(line_item)

    vendor_orders = []
    for vid, items in vendor_assignments.items():
        subtotal = round(sum(li.line_total for li in items), 2)
        vendor_orders.append(VendorOrder(
            vendor_id=vid,
            vendor_name=vendor_map[vid],
            items=items,
            subtotal=subtotal,
        ))

    total_cost = round(sum(vo.subtotal for vo in vendor_orders), 2)

    comparison_vendors = []
    for v in all_vendors:
        hypothetical_costs = vendor_hypothetical[v.id]
        total_if_all = round(sum(hypothetical_costs), 2) if hypothetical_costs else None
        comparison_vendors.append(VendorComparison(
            vendor_id=v.id,
            vendor_name=v.name,
            total_if_all=total_if_all,
            items_carried=vendor_items_carried[v.id],
            items_selected=items_selected,
        ))

    valid_totals = [vc.total_if_all for vc in comparison_vendors if vc.total_if_all is not None]
    savings_vs_worst = round(max(valid_totals) - total_cost, 2) if valid_totals else 0.0

    comparison = ComparisonData(
        vendors=comparison_vendors,
        savings_vs_worst=savings_vs_worst,
    )

    return AssembleOrderOut(
        vendor_orders=vendor_orders,
        total_cost=total_cost,
        unpriced_items=unpriced_items,
        comparison=comparison,
    )


# ── New Phase 3 endpoints ─────────────────────────────────────────────────────

@router.post("/", response_model=OrderListItem)
def save_order(payload: SaveOrderIn, db: Session = Depends(get_db)):
    order = Order(
        location_id=payload.location_id,
        total_cost=payload.total_cost,
        savings_vs_worst=payload.savings_vs_worst,
        status="saved",
        notes_to_john=payload.notes_to_john,
        requires_review=payload.requires_review,
        review_status='pending' if payload.requires_review else 'not_required',
        taco_flag_count=payload.taco_flag_count,
    )
    db.add(order)
    db.flush()  # get order.id before committing

    for item in payload.items:
        # quantity/unit_price/line_total may be None for taco-flagged NoPar items
        # (no PAR set, no vendor assignment, no price). Default to 0/0.0 so the
        # DB non-null constraint is satisfied while preserving the flag/note data.
        oi = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            quantity=item.quantity if item.quantity is not None else 0,
            selected_vendor_id=item.selected_vendor_id,
            unit_price=item.unit_price if item.unit_price is not None else 0.0,
            line_total=item.line_total if item.line_total is not None else 0.0,
            item_note=item.item_note,
            flag=item.flag,
        )
        db.add(oi)

    for split in payload.vendor_splits:
        vs = OrderVendorSplit(
            order_id=order.id,
            vendor_id=split.vendor_id,
            total=split.total,
        )
        db.add(vs)

    db.commit()
    db.refresh(order)

    return OrderListItem(
        id=order.id,
        created_at=order.created_at,
        total_cost=order.total_cost,
        savings_vs_worst=order.savings_vs_worst,
        item_count=len(payload.items),
        vendor_count=len(payload.vendor_splits),
        status=order.status,
        requires_review=order.requires_review,
        review_status=order.review_status,
        taco_flag_count=order.taco_flag_count,
    )


@router.get("/summary", response_model=SpendSummaryOut)
def get_spend_summary(period: str = "all", db: Session = Depends(get_db)):
    query = db.query(Order)
    query = _period_filter(query, period)
    orders = query.all()

    total_spent = round(sum(o.total_cost for o in orders), 2)
    total_saved = round(sum(o.savings_vs_worst for o in orders), 2)

    return SpendSummaryOut(
        total_spent=total_spent,
        total_saved=total_saved,
        order_count=len(orders),
        period=period,
    )


@router.get("/export/csv")
def export_orders_csv(period: str = "all", db: Session = Depends(get_db)):
    query = db.query(Order)
    query = _period_filter(query, period)
    orders = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Order ID", "Date", "Total Cost", "Savings vs Worst", "Status", "Item Count", "Vendor Count"])

    for o in orders:
        item_count = len(o.items)
        vendor_count = len(o.vendor_splits)
        writer.writerow([
            o.id,
            o.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            f"{o.total_cost:.2f}",
            f"{o.savings_vs_worst:.2f}",
            o.status,
            item_count,
            vendor_count,
        ])

    output.seek(0)
    filename = f"orders_{period}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/", response_model=list[OrderListItem])
def list_orders(period: str = "all", db: Session = Depends(get_db)):
    query = db.query(Order)
    query = _period_filter(query, period)
    orders = query.order_by(Order.created_at.desc()).all()

    result = []
    for o in orders:
        result.append(OrderListItem(
            id=o.id,
            created_at=o.created_at,
            total_cost=o.total_cost,
            savings_vs_worst=o.savings_vs_worst,
            item_count=len(o.items),
            vendor_count=len(o.vendor_splits),
            status=o.status,
            requires_review=o.requires_review,
            review_status=o.review_status,
            review_note=o.review_note,
        ))
    return result


@router.get("/pending-review", response_model=list[OrderDetailOut])
def get_pending_review_orders(db: Session = Depends(get_db)):
    """Orders that require review and are pending."""
    orders = (
        db.query(Order)
        .filter(Order.requires_review == True, Order.review_status == 'pending')
        .order_by(Order.created_at.desc())
        .all()
    )
    result = []
    for order in orders:
        items = []
        for oi in order.items:
            product = db.query(Product).filter(Product.id == oi.product_id).first()
            vendor = db.query(Vendor).filter(Vendor.id == oi.selected_vendor_id).first()
            items.append(OrderDetailLineItem(
                product_id=oi.product_id,
                product_name=product.name if product else f"Product #{oi.product_id}",
                quantity=oi.quantity,
                selected_vendor_id=oi.selected_vendor_id,
                vendor_name=vendor.name if vendor else None,
                unit_price=oi.unit_price,
                line_total=oi.line_total,
                item_note=oi.item_note,
                flag=oi.flag,
            ))
        vendor_splits = []
        for vs in order.vendor_splits:
            vendor = db.query(Vendor).filter(Vendor.id == vs.vendor_id).first()
            vendor_splits.append(OrderDetailVendorSplit(
                vendor_id=vs.vendor_id,
                vendor_name=vendor.name if vendor else f"Vendor #{vs.vendor_id}",
                total=vs.total,
            ))
        result.append(OrderDetailOut(
            id=order.id,
            created_at=order.created_at,
            status=order.status,
            total_cost=order.total_cost,
            savings_vs_worst=order.savings_vs_worst,
            items=items,
            vendor_splits=vendor_splits,
            notes_to_john=order.notes_to_john,
            requires_review=order.requires_review,
            review_status=order.review_status,
            review_note=order.review_note,
            taco_flag_count=order.taco_flag_count,
        ))
    return result


@router.post("/{order_id}/review", response_model=OrderListItem)
def review_order(order_id: int, payload: OrderReviewIn, db: Session = Depends(get_db)):
    """Approve or update review status of an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.review_status = payload.review_status
    if payload.review_note is not None:
        order.review_note = payload.review_note
    db.commit()
    db.refresh(order)
    return OrderListItem(
        id=order.id,
        created_at=order.created_at,
        total_cost=order.total_cost,
        savings_vs_worst=order.savings_vs_worst,
        item_count=len(order.items),
        vendor_count=len(order.vendor_splits),
        status=order.status,
        requires_review=order.requires_review,
        review_status=order.review_status,
        taco_flag_count=order.taco_flag_count,
    )


@router.get("/{order_id}", response_model=OrderDetailOut)
def get_order_detail(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = []
    for oi in order.items:
        product = db.query(Product).filter(Product.id == oi.product_id).first()
        vendor = db.query(Vendor).filter(Vendor.id == oi.selected_vendor_id).first()
        items.append(OrderDetailLineItem(
            product_id=oi.product_id,
            product_name=product.name if product else f"Product #{oi.product_id}",
            quantity=oi.quantity,
            selected_vendor_id=oi.selected_vendor_id,
            vendor_name=vendor.name if vendor else None,
            unit_price=oi.unit_price,
            line_total=oi.line_total,
            item_note=oi.item_note,
            flag=oi.flag,
        ))

    vendor_splits = []
    for vs in order.vendor_splits:
        vendor = db.query(Vendor).filter(Vendor.id == vs.vendor_id).first()
        vendor_splits.append(OrderDetailVendorSplit(
            vendor_id=vs.vendor_id,
            vendor_name=vendor.name if vendor else f"Vendor #{vs.vendor_id}",
            total=vs.total,
        ))

    return OrderDetailOut(
        id=order.id,
        created_at=order.created_at,
        status=order.status,
        total_cost=order.total_cost,
        savings_vs_worst=order.savings_vs_worst,
        items=items,
        vendor_splits=vendor_splits,
        notes_to_john=order.notes_to_john,
        requires_review=order.requires_review,
        review_status=order.review_status,
        review_note=order.review_note,
        taco_flag_count=order.taco_flag_count,
    )
