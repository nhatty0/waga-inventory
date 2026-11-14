from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import get_session
from app.models import Product, ProductVariant, Shop
from app.routers.auth import get_current_shop
from app.schemas import InventoryActionResponse, InventoryAdjustRequest, ReceiveTransitRequest

router = APIRouter(prefix="/inventory", tags=["Inventory"])


class AddTransitRequest(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0, description="Quantity shipped from Merkato (Addis Ababa)")
    notes: str | None = None


class UpdateVariantRequest(BaseModel):
    barcode: str | None = None
    brand: str | None = None
    spec: str | None = None
    cost_price: float | None = None
    retail_price: float | None = None
    wholesale_price: float | None = None
    stock_quantity: int | None = Field(default=None, ge=0)
    in_transit_quantity: int | None = Field(default=None, ge=0)


@router.get("/barcode/{code}")
def scan_lookup(
    code: str,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """Instant lookup when camera scans any barcode, scoped to current shop."""
    clean_code = code.strip()
    variant = session.exec(
        select(ProductVariant)
        .join(Product)
        .where(ProductVariant.barcode == clean_code, Product.shop_id == shop.id)
    ).first()

    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Barcode {clean_code} is not registered."
        )

    product = session.get(Product, variant.product_id)
    return {
        "variant": variant,
        "product_name": product.name if product else "",
        "category": product.category if product else "",
        "product": product
    }


@router.post("/adjust", response_model=InventoryActionResponse)
def adjust_stock(
    payload: InventoryAdjustRequest,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """Quickly add or subtract stock for a variant in the current shop."""
    variant = session.get(ProductVariant, payload.variant_id)
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {payload.variant_id} not found."
        )
    product = session.get(Product, variant.product_id)
    if not product or product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {payload.variant_id} not found."
        )

    previous_stock = variant.stock_quantity
    new_stock = previous_stock + payload.delta

    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot reduce stock by {abs(payload.delta)}. "
                f"Current stock is {previous_stock} units."
            )
        )

    variant.stock_quantity = new_stock
    session.add(variant)
    session.commit()
    session.refresh(variant)

    action_verb = "increased" if payload.delta >= 0 else "decreased"
    notes_memo = f" (Notes: {payload.notes})" if payload.notes else ""

    return InventoryActionResponse(
        variant_id=variant.id,  # type: ignore
        brand=variant.brand,
        spec=variant.spec,
        previous_stock=previous_stock,
        new_stock=variant.stock_quantity,
        previous_in_transit=variant.in_transit_quantity,
        new_in_transit=variant.in_transit_quantity,
        message=f"Stock {action_verb} by {abs(payload.delta)} units.{notes_memo}"
    )


@router.post("/receive-transit", response_model=InventoryActionResponse)
def receive_transit(
    payload: ReceiveTransitRequest,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """Shift items from in_transit_quantity to stock_quantity when trucks arrive from Merkato."""
    variant = session.get(ProductVariant, payload.variant_id)
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {payload.variant_id} not found."
        )
    product = session.get(Product, variant.product_id)
    if not product or product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {payload.variant_id} not found."
        )

    if payload.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity to receive must be greater than zero."
        )

    if variant.in_transit_quantity < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot receive {payload.quantity} units from Merkato transit. "
                f"Only {variant.in_transit_quantity} units are currently marked in-transit."
            )
        )

    prev_stock = variant.stock_quantity
    prev_transit = variant.in_transit_quantity

    variant.in_transit_quantity -= payload.quantity
    variant.stock_quantity += payload.quantity

    session.add(variant)
    session.commit()
    session.refresh(variant)

    notes_memo = f" (Memo: {payload.notes})" if payload.notes else ""

    return InventoryActionResponse(
        variant_id=variant.id,  # type: ignore
        brand=variant.brand,
        spec=variant.spec,
        previous_stock=prev_stock,
        new_stock=variant.stock_quantity,
        previous_in_transit=prev_transit,
        new_in_transit=variant.in_transit_quantity,
        message=(
            f"Successfully received {payload.quantity} units from Merkato into shelf stock.{notes_memo}"
        )
    )


@router.post("/add-transit", response_model=InventoryActionResponse)
def add_to_transit(
    payload: AddTransitRequest,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """Record new freight dispatched from Merkato (Addis Ababa) to Gondar for current shop."""
    variant = session.get(ProductVariant, payload.variant_id)
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {payload.variant_id} not found."
        )
    product = session.get(Product, variant.product_id)
    if not product or product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {payload.variant_id} not found."
        )

    prev_transit = variant.in_transit_quantity
    variant.in_transit_quantity += payload.quantity

    session.add(variant)
    session.commit()
    session.refresh(variant)

    memo = f" ({payload.notes})" if payload.notes else ""
    return InventoryActionResponse(
        variant_id=variant.id,  # type: ignore
        brand=variant.brand,
        spec=variant.spec,
        previous_stock=variant.stock_quantity,
        new_stock=variant.stock_quantity,
        previous_in_transit=prev_transit,
        new_in_transit=variant.in_transit_quantity,
        message=f"Added {payload.quantity} units to freight transit.{memo}"
    )


@router.put("/variants/{variant_id}", response_model=ProductVariant)
def update_variant(
    variant_id: int,
    payload: UpdateVariantRequest,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """Update variant details (price, specs, stock) from the Edit Modal, scoped to current shop."""
    variant = session.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {variant_id} not found."
        )
    product = session.get(Product, variant.product_id)
    if not product or product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {variant_id} not found."
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(variant, field, value)

    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


@router.delete("/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_variant(
    variant_id: int,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """Delete a variant from the inventory catalog, scoped to current shop."""
    variant = session.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {variant_id} not found."
        )
    product = session.get(Product, variant.product_id)
    if not product or product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductVariant with ID {variant_id} not found."
        )

    session.delete(variant)
    session.commit()
    return None
