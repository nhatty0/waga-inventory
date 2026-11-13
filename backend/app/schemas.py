from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, computed_field

from app.models import ClientType, OrderStatus, OrderType


# ---------------------------------------------------------
# Product & Variant Schemas
# ---------------------------------------------------------
class VariantBase(BaseModel):
    barcode: Optional[str] = None
    brand: str
    spec: str
    cost_price: float = Field(ge=0.0, description="Cost price in ETB")
    retail_price: float = Field(ge=0.0, description="Standard retail price in ETB")
    wholesale_price: float = Field(ge=0.0, description="Bulk / wholesale price in ETB")
    stock_quantity: int = Field(default=0, ge=0)
    in_transit_quantity: int = Field(default=0, ge=0)


class VariantCreate(VariantBase):
    pass


class VariantUpdate(BaseModel):
    barcode: Optional[str] = None
    brand: Optional[str] = None
    spec: Optional[str] = None
    product_name: Optional[str] = None
    cost_price: Optional[float] = Field(default=None, ge=0.0)
    retail_price: Optional[float] = Field(default=None, ge=0.0)
    wholesale_price: Optional[float] = Field(default=None, ge=0.0)
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    in_transit_quantity: Optional[int] = Field(default=None, ge=0)


class VariantRead(VariantBase):
    id: int
    product_id: int

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    name: str
    category: str


class ProductCreate(ProductBase):
    variants: List[VariantCreate] = Field(
        default_factory=list,
        description="Nested initial variants for the product"
    )


class ProductRead(ProductBase):
    id: int
    shop_id: Optional[int] = None
    created_at: datetime
    variants: List[VariantRead] = Field(default_factory=list)

    @computed_field
    @property
    def total_stock(self) -> int:
        return sum(v.stock_quantity for v in self.variants)

    @computed_field
    @property
    def total_in_transit(self) -> int:
        return sum(v.in_transit_quantity for v in self.variants)

    class Config:
        from_attributes = True


# ---------------------------------------------------------
# Inventory Schemas
# ---------------------------------------------------------
class InventoryAdjustRequest(BaseModel):
    variant_id: int
    delta: int = Field(
        description="Signed integer to add (e.g. +5) or subtract (e.g. -2) from stock"
    )
    notes: Optional[str] = None


class ReceiveTransitRequest(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0, description="Number of arriving units to shift from transit to stock")
    notes: Optional[str] = None


class InventoryActionResponse(BaseModel):
    variant_id: int
    brand: str
    spec: str
    previous_stock: int
    new_stock: int
    previous_in_transit: int
    new_in_transit: int
    message: str


# ---------------------------------------------------------
# Client Schemas
# ---------------------------------------------------------
class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    type: ClientType = ClientType.REGULAR_CUSTOMER
    location: str = "Gondar"


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    type: Optional[ClientType] = None
    location: Optional[str] = None


class ClientRead(ClientBase):
    id: int
    shop_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------
# Order & Item Schemas
# ---------------------------------------------------------
class OrderItemCreate(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0.0)


class OrderItemRead(BaseModel):
    id: int
    order_id: int
    variant_id: int
    quantity: int
    unit_price: float
    brand: Optional[str] = None
    spec: Optional[str] = None

    @computed_field
    @property
    def subtotal(self) -> float:
        return round(self.quantity * self.unit_price, 2)

    class Config:
        from_attributes = True


class OrderDispatchCreate(BaseModel):
    client_id: Optional[int] = Field(
        default=None,
        description="Client ID (required for NEIGHBOR_LEND and RURAL_BULK, optional for RETAIL)"
    )
    order_type: OrderType
    items: List[OrderItemCreate] = Field(
        ...,
        min_length=1,
        description="At least one item required"
    )
    amount_paid: float = Field(
        default=0.0,
        ge=0.0,
        description="Initial down payment / cash received"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Driver details, borrower note, or destination"
    )


class OrderRead(BaseModel):
    id: int
    shop_id: Optional[int] = None
    client_id: Optional[int]
    order_type: OrderType
    status: OrderStatus
    total_amount: float
    amount_paid: float
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_plate: Optional[str] = None
    notes: Optional[str]
    created_at: datetime
    client: Optional[ClientRead] = None
    items: List[OrderItemRead] = Field(default_factory=list)

    @computed_field
    @property
    def balance_due(self) -> float:
        return max(0.0, round(self.total_amount - self.amount_paid, 2))

    class Config:
        from_attributes = True


# ---------------------------------------------------------
# Ledger Schemas
# ---------------------------------------------------------
class OrderSettleRequest(BaseModel):
    payment_amount: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Additional payment to record. If omitted, full remaining balance is settled."
    )
    restock_returned_items: bool = Field(
        default=False,
        description="If true, items are returned back to shelf inventory (e.g., lent item returned unsold)."
    )
    notes: Optional[str] = Field(
        default=None,
        description="Settlement memo, e.g. 'Returned Skyworth TV in pristine condition' or 'Paid via CBE Birr'"
    )


class UnreturnedItemSummary(BaseModel):
    variant_id: int
    brand: str
    spec: str
    quantity: int


class ClientLedgerGroup(BaseModel):
    client: ClientRead
    total_owed: float
    open_orders_count: int
    orders: List[OrderRead]
    unreturned_items: List[UnreturnedItemSummary]


class OpenLedgerResponse(BaseModel):
    total_receivables: float
    total_open_orders: int
    clients: List[ClientLedgerGroup]
    anonymous_orders: List[OrderRead] = Field(default_factory=list)
