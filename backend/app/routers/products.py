from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Product, ProductVariant, Shop
from app.routers.auth import get_current_shop
from app.schemas import ProductCreate, ProductRead, VariantCreate, VariantRead, VariantUpdate

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Create a new product with optional nested initial variants belonging to current shop.
    """
    db_product = Product(
        shop_id=shop.id,  # type: ignore
        name=product_in.name.strip(),
        category=product_in.category.strip()
    )
    session.add(db_product)
    session.flush()  # Populates db_product.id

    for v_in in product_in.variants:
        variant = ProductVariant(
            product_id=db_product.id,
            barcode=v_in.barcode.strip() if v_in.barcode and v_in.barcode.strip() else None,
            brand=v_in.brand.strip(),
            spec=v_in.spec.strip(),
            cost_price=v_in.cost_price,
            retail_price=v_in.retail_price,
            wholesale_price=v_in.wholesale_price,
            stock_quantity=v_in.stock_quantity,
            in_transit_quantity=v_in.in_transit_quantity,
        )
        session.add(variant)

    session.commit()
    session.refresh(db_product)
    return db_product


@router.get("", response_model=List[ProductRead])
def list_products(
    category: Optional[str] = Query(default=None, description="Filter by category (e.g. TV, Kitchen)"),
    search: Optional[str] = Query(default=None, description="Search products by name or brand"),
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    List all products belonging to current shop grouped with their variants and real-time stock levels.
    """
    query = select(Product).where(Product.shop_id == shop.id)
    if category:
        query = query.where(Product.category.ilike(f"%{category.strip()}%"))

    products = session.exec(query).all()

    if search:
        search_lower = search.strip().lower()
        filtered = []
        for p in products:
            name_match = search_lower in p.name.lower()
            variant_match = any(
                search_lower in v.brand.lower() or search_lower in v.spec.lower()
                for v in p.variants
            )
            if name_match or variant_match:
                filtered.append(p)
        return filtered

    return products


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: int,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Get a single product and its variants by ID, scoped to current shop.
    """
    product = session.get(Product, product_id)
    if not product or product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return product


@router.post("/{product_id}/variants", response_model=VariantRead, status_code=status.HTTP_201_CREATED)
def add_product_variant(
    product_id: int,
    variant_in: VariantCreate,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Add a new variant to an existing product in the current shop.
    """
    product = session.get(Product, product_id)
    if not product or product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    variant = ProductVariant(
        product_id=product.id,
        barcode=variant_in.barcode.strip() if variant_in.barcode and variant_in.barcode.strip() else None,
        brand=variant_in.brand.strip(),
        spec=variant_in.spec.strip(),
        cost_price=variant_in.cost_price,
        retail_price=variant_in.retail_price,
        wholesale_price=variant_in.wholesale_price,
        stock_quantity=variant_in.stock_quantity,
        in_transit_quantity=variant_in.in_transit_quantity,
    )
    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


@router.put("/variants/{variant_id}", response_model=VariantRead)
@router.patch("/variants/{variant_id}", response_model=VariantRead)
def update_product_variant(
    variant_id: int,
    variant_in: VariantUpdate,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Update an existing variant's details, stock levels, and prices.
    Also optionally updates the parent product name, scoped to current shop.
    """
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

    if variant_in.barcode is not None:
        clean_bc = variant_in.barcode.strip()
        variant.barcode = clean_bc if clean_bc else None
    if variant_in.brand is not None:
        variant.brand = variant_in.brand.strip()
    if variant_in.spec is not None:
        variant.spec = variant_in.spec.strip()
    if variant_in.cost_price is not None:
        variant.cost_price = max(0.0, variant_in.cost_price)
    if variant_in.retail_price is not None:
        variant.retail_price = max(0.0, variant_in.retail_price)
    if variant_in.wholesale_price is not None:
        variant.wholesale_price = max(0.0, variant_in.wholesale_price)
    if variant_in.stock_quantity is not None:
        variant.stock_quantity = max(0, variant_in.stock_quantity)
    if variant_in.in_transit_quantity is not None:
        variant.in_transit_quantity = max(0, variant_in.in_transit_quantity)

    if variant_in.product_name is not None and variant_in.product_name.strip():
        product.name = variant_in.product_name.strip()
        session.add(product)

    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant
