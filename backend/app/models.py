from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ClientType(str, Enum):
    NEIGHBOR_BORROWER = "NEIGHBOR_BORROWER"
    RURAL_WHOLESALER = "RURAL_WHOLESALER"
    REGULAR_CUSTOMER = "REGULAR_CUSTOMER"


class OrderType(str, Enum):
    RETAIL = "RETAIL"
    NEIGHBOR_LEND = "NEIGHBOR_LEND"
    RURAL_BULK = "RURAL_BULK"
    INBOUND_MERKATO = "INBOUND_MERKATO"


class OrderStatus(str, Enum):
    PENDING_RETURN = "PENDING_RETURN"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    COMPLETED = "COMPLETED"


class Shop(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)                     # e.g. "Estif Electronics"
    location: str = Field(default="Gondar")
    owner_phone: str = Field(unique=True, index=True) # Normalized e.g. "0918..."
    pin_hash: str                                     # Hashed 4-digit PIN
    telegram_chat_id: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_id: int = Field(foreign_key="shop.id", index=True)
    name: str = Field(index=True)
    category: str = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now)

    variants: List["ProductVariant"] = Relationship(
        back_populates="product",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ProductVariant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    barcode: Optional[str] = Field(default=None, index=True)
    brand: str = Field(index=True)
    spec: str
    cost_price: float = Field(default=0.0, ge=0.0)
    retail_price: float = Field(default=0.0, ge=0.0)
    wholesale_price: float = Field(default=0.0, ge=0.0)
    stock_quantity: int = Field(default=0)
    in_transit_quantity: int = Field(default=0)

    product: Optional[Product] = Relationship(back_populates="variants")
    order_items: List["OrderItem"] = Relationship(back_populates="variant")


class Client(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_id: int = Field(foreign_key="shop.id", index=True)
    name: str = Field(index=True)
    phone: Optional[str] = Field(default=None, index=True)
    type: ClientType = Field(default=ClientType.REGULAR_CUSTOMER, index=True)
    location: str = Field(default="Gondar", index=True)
    created_at: datetime = Field(default_factory=utc_now)

    orders: List["Order"] = Relationship(back_populates="client")


class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_id: int = Field(foreign_key="shop.id", index=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client.id", nullable=True)
    order_type: OrderType = Field(index=True)
    status: OrderStatus = Field(default=OrderStatus.COMPLETED, index=True)
    total_amount: float = Field(default=0.0, ge=0.0)
    amount_paid: float = Field(default=0.0, ge=0.0)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utc_now)

    driver_name: Optional[str] = Field(default=None)
    driver_phone: Optional[str] = Field(default=None)
    vehicle_plate: Optional[str] = Field(default=None)

    client: Optional[Client] = Relationship(back_populates="orders")
    items: List["OrderItem"] = Relationship(
        back_populates="order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class OrderItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id", index=True)
    variant_id: int = Field(foreign_key="productvariant.id", index=True)
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0.0)

    order: Optional[Order] = Relationship(back_populates="items")
    variant: Optional[ProductVariant] = Relationship(back_populates="order_items")