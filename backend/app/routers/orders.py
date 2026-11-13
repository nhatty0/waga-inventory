from collections import defaultdict
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import get_session
from app.models import Client, ClientType, Order, OrderItem, OrderStatus, OrderType, Product, ProductVariant, Shop
from app.routers.auth import get_current_shop
from app.schemas import (
    ClientLedgerGroup,
    ClientRead,
    OpenLedgerResponse,
    OrderItemRead,
    OrderRead,
    OrderSettleRequest,
    UnreturnedItemSummary,
)

orders_router = APIRouter(prefix="/orders", tags=["Orders"])
ledger_router = APIRouter(prefix="/ledger", tags=["Ledger"])


# --- Flexible Input Schemas ---
class DispatchItemCreate(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0.0)


class FlexibleOrderDispatchCreate(BaseModel):
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_location: Optional[str] = "Gondar"
    order_type: OrderType
    items: List[DispatchItemCreate]
    amount_paid: float = Field(default=0.0, ge=0.0)
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_plate: Optional[str] = None
    notes: Optional[str] = None


def _format_order_response(order: Order, session: Session) -> OrderRead:
    """Helper to convert Order DB model to OrderRead schema with populated items and variant metadata."""
    items_read: List[OrderItemRead] = []
    for item in order.items:
        variant = session.get(ProductVariant, item.variant_id)
        brand = variant.brand if variant else "Unknown"
        spec = variant.spec if variant else "Unknown"
        items_read.append(
            OrderItemRead(
                id=item.id,  # type: ignore
                order_id=item.order_id,
                variant_id=item.variant_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                brand=brand,
                spec=spec,
            )
        )

    client_read = None
    if order.client_id:
        client = session.get(Client, order.client_id)
        if client:
            client_read = ClientRead.model_validate(client)

    return OrderRead(
        id=order.id,  # type: ignore
        shop_id=order.shop_id,
        client_id=order.client_id,
        order_type=order.order_type,
        status=order.status,
        total_amount=order.total_amount,
        amount_paid=order.amount_paid,
        driver_name=order.driver_name,
        driver_phone=order.driver_phone,
        vehicle_plate=order.vehicle_plate,
        notes=order.notes,
        created_at=order.created_at,
        client=client_read,
        items=items_read,
    )


# -------------------------------------------------------------------
# Orders Endpoints
# -------------------------------------------------------------------
@orders_router.post("/dispatch", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def dispatch_order(
    dispatch_in: FlexibleOrderDispatchCreate,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Atomic transaction:
    1. Finds or auto-creates Client for current shop if client_name is provided.
    2. Validates sufficient stock for all requested items in current shop.
    3. Decrements shelf stock_quantity.
    4. Computes total amount and sets status:
       - PENDING_RETURN if NEIGHBOR_LEND and unpaid.
       - PARTIALLY_PAID if RURAL_BULK with remaining balance.
       - COMPLETED if paid in full.
    """
    if not dispatch_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one item must be included in the dispatch."
        )

    target_client_id = dispatch_in.client_id

    # Verify existing client belongs to current shop
    if target_client_id:
        client = session.get(Client, target_client_id)
        if not client or client.shop_id != shop.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client with ID {target_client_id} not found."
            )

    # Auto-resolve or create client if only name was provided
    if not target_client_id and dispatch_in.client_name:
        clean_name = dispatch_in.client_name.strip()
        client = session.exec(
            select(Client).where(Client.name == clean_name, Client.shop_id == shop.id)
        ).first()
        if not client:
            if dispatch_in.order_type == OrderType.NEIGHBOR_LEND:
                default_type = ClientType.NEIGHBOR_BORROWER
            elif dispatch_in.order_type == OrderType.RURAL_BULK:
                default_type = ClientType.RURAL_WHOLESALER
            else:
                default_type = ClientType.REGULAR_CUSTOMER
            client = Client(
                shop_id=shop.id,  # type: ignore
                name=clean_name,
                phone=dispatch_in.client_phone,
                type=default_type,
                location=dispatch_in.client_location or "Gondar"
            )
            session.add(client)
            session.commit()
            session.refresh(client)
        target_client_id = client.id

    # Validation for borrower/wholesale requirements
    if dispatch_in.order_type in [OrderType.NEIGHBOR_LEND, OrderType.RURAL_BULK] and not target_client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Client information is required for order type '{dispatch_in.order_type.value}'."
        )

    total_amount = 0.0
    prepared_items: List[OrderItem] = []

    try:
        # Validate stock and verify variants belong to current shop
        for item_in in dispatch_in.items:
            variant = session.get(ProductVariant, item_in.variant_id)
            if not variant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"ProductVariant with ID {item_in.variant_id} not found."
                )
            product = session.get(Product, variant.product_id)
            if not product or product.shop_id != shop.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"ProductVariant with ID {item_in.variant_id} not found."
                )

            if variant.stock_quantity < item_in.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for '{variant.brand} - {variant.spec}': "
                        f"requested {item_in.quantity}, but only {variant.stock_quantity} available in shop."
                    )
                )

            variant.stock_quantity -= item_in.quantity
            session.add(variant)

            item_total = item_in.quantity * item_in.unit_price
            total_amount += item_total

            prepared_items.append(
                OrderItem(
                    variant_id=item_in.variant_id,
                    quantity=item_in.quantity,
                    unit_price=item_in.unit_price,
                )
            )

        total_amount = round(total_amount, 2)
        amount_paid = min(dispatch_in.amount_paid, total_amount)

        # Status computation
        if amount_paid >= total_amount:
            computed_status = OrderStatus.COMPLETED
        else:
            if dispatch_in.order_type == OrderType.NEIGHBOR_LEND:
                computed_status = OrderStatus.PENDING_RETURN
            else:
                computed_status = OrderStatus.PARTIALLY_PAID

        # Build notes with driver / vehicle info if provided
        logistics_notes = []
        if dispatch_in.driver_name:
            logistics_notes.append(f"Driver: {dispatch_in.driver_name}")
        if dispatch_in.driver_phone:
            logistics_notes.append(f"Phone: {dispatch_in.driver_phone}")
        if dispatch_in.vehicle_plate:
            logistics_notes.append(f"Plate: {dispatch_in.vehicle_plate}")
        if dispatch_in.notes:
            logistics_notes.append(dispatch_in.notes)

        final_notes = " | ".join(logistics_notes) if logistics_notes else None

        order = Order(
            shop_id=shop.id,  # type: ignore
            client_id=target_client_id,
            order_type=dispatch_in.order_type,
            status=computed_status,
            total_amount=total_amount,
            amount_paid=amount_paid,
            driver_name=dispatch_in.driver_name,
            driver_phone=dispatch_in.driver_phone,
            vehicle_plate=dispatch_in.vehicle_plate,
            notes=final_notes,
        )
        session.add(order)
        session.flush()

        for p_item in prepared_items:
            p_item.order_id = order.id  # type: ignore
            session.add(p_item)

        session.commit()
        session.refresh(order)

    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to dispatch order: {str(exc)}"
        )

    return _format_order_response(order, session)


@orders_router.get("", response_model=List[OrderRead])
def list_orders(
    client_id: Optional[int] = Query(default=None, description="Filter by client ID"),
    order_type: Optional[OrderType] = Query(default=None, description="Filter by order type"),
    order_status: Optional[OrderStatus] = Query(default=None, description="Filter by order status"),
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    query = select(Order).where(Order.shop_id == shop.id)
    if client_id is not None:
        query = query.where(Order.client_id == client_id)
    if order_type is not None:
        query = query.where(Order.order_type == order_type)
    if order_status is not None:
        query = query.where(Order.status == order_status)

    orders = session.exec(query.order_by(Order.created_at.desc())).all()
    return [_format_order_response(o, session) for o in orders]


@orders_router.get("/{order_id}", response_model=OrderRead)
def get_order(
    order_id: int,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    order = session.get(Order, order_id)
    if not order or order.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )
    return _format_order_response(order, session)


# -------------------------------------------------------------------
# Ledger Endpoints
# -------------------------------------------------------------------
@ledger_router.get("/open", response_model=OpenLedgerResponse)
def get_open_ledger(
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    open_statuses = [OrderStatus.PENDING_RETURN, OrderStatus.PARTIALLY_PAID]
    query = (
        select(Order)
        .where(Order.shop_id == shop.id, Order.status.in_(open_statuses))
        .order_by(Order.created_at.asc())
    )
    open_orders = session.exec(query).all()

    clients_map = defaultdict(list)
    anonymous_orders: List[OrderRead] = []
    total_receivables = 0.0

    for order in open_orders:
        order_read = _format_order_response(order, session)
        balance = max(0.0, order.total_amount - order.amount_paid)
        total_receivables += balance

        if order.client_id:
            clients_map[order.client_id].append((order, order_read))
        else:
            anonymous_orders.append(order_read)

    client_groups: List[ClientLedgerGroup] = []

    for client_id, orders_tuples in clients_map.items():
        client = session.get(Client, client_id)
        if not client or client.shop_id != shop.id:
            continue

        orders_list = [o_read for _, o_read in orders_tuples]
        client_owed = sum(max(0.0, o.total_amount - o.amount_paid) for o, _ in orders_tuples)

        items_counter = defaultdict(lambda: {"quantity": 0, "brand": "", "spec": ""})
        for o, _ in orders_tuples:
            for item in o.items:
                variant = session.get(ProductVariant, item.variant_id)
                brand = variant.brand if variant else "Unknown"
                spec = variant.spec if variant else "Unknown"
                items_counter[item.variant_id]["quantity"] += item.quantity
                items_counter[item.variant_id]["brand"] = brand
                items_counter[item.variant_id]["spec"] = spec

        unreturned_items = [
            UnreturnedItemSummary(
                variant_id=vid,
                brand=data["brand"],
                spec=data["spec"],
                quantity=data["quantity"],
            )
            for vid, data in items_counter.items()
        ]

        client_groups.append(
            ClientLedgerGroup(
                client=ClientRead.model_validate(client),
                total_owed=round(client_owed, 2),
                open_orders_count=len(orders_list),
                orders=orders_list,
                unreturned_items=unreturned_items,
            )
        )

    return OpenLedgerResponse(
        total_receivables=round(total_receivables, 2),
        total_open_orders=len(open_orders),
        clients=client_groups,
        anonymous_orders=anonymous_orders,
    )


@ledger_router.post("/{order_id}/settle", response_model=OrderRead)
def settle_order(
    order_id: int,
    settle_in: Optional[OrderSettleRequest] = None,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    order = session.get(Order, order_id)
    if not order or order.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )

    if order.status == OrderStatus.COMPLETED:
        return _format_order_response(order, session)

    if settle_in is None:
        settle_in = OrderSettleRequest()

    memos = []

    # If items are returned unsold, add them back to shelf stock
    if settle_in.restock_returned_items:
        for item in order.items:
            variant = session.get(ProductVariant, item.variant_id)
            if variant:
                variant.stock_quantity += item.quantity
                session.add(variant)
        memos.append("Lent items returned and restocked")
        order.status = OrderStatus.COMPLETED

    # If monetary payment received
    if settle_in.payment_amount is not None and settle_in.payment_amount > 0:
        order.amount_paid += settle_in.payment_amount
        memos.append(f"Recorded payment +{settle_in.payment_amount:.2f} ETB")
        if order.amount_paid >= order.total_amount:
            order.status = OrderStatus.COMPLETED
    elif not settle_in.restock_returned_items:
        remaining = max(0.0, order.total_amount - order.amount_paid)
        order.amount_paid = order.total_amount
        memos.append(f"Full remaining balance ({remaining:.2f} ETB) settled")
        order.status = OrderStatus.COMPLETED

    if settle_in.notes:
        memos.append(settle_in.notes)

    if memos:
        joined_memo = "; ".join(memos)
        order.notes = f"{order.notes} | [Settled: {joined_memo}]" if order.notes else f"[Settled: {joined_memo}]"

    session.add(order)
    session.commit()
    session.refresh(order)

    return _format_order_response(order, session)
