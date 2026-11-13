from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Client, ClientType, Shop
from app.routers.auth import get_current_shop
from app.schemas import ClientCreate, ClientRead, ClientUpdate

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
def create_client(
    client_in: ClientCreate,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Create a new client (Neighbor Borrower, Rural Wholesaler, or Regular Customer) for current shop.
    """
    client = Client(
        shop_id=shop.id,  # type: ignore
        name=client_in.name.strip(),
        phone=client_in.phone.strip() if client_in.phone else None,
        type=client_in.type,
        location=client_in.location.strip()
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.get("", response_model=List[ClientRead])
def list_clients(
    client_type: Optional[ClientType] = Query(default=None, description="Filter by client type"),
    search: Optional[str] = Query(default=None, description="Search client by name, phone or location"),
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    List all registered clients belonging to current shop.
    """
    query = select(Client).where(Client.shop_id == shop.id)
    if client_type:
        query = query.where(Client.type == client_type)

    clients = session.exec(query).all()

    if search:
        search_lower = search.strip().lower()
        clients = [
            c for c in clients
            if search_lower in c.name.lower()
            or (c.phone and search_lower in c.phone.lower())
            or search_lower in c.location.lower()
        ]

    return clients


@router.get("/{client_id}", response_model=ClientRead)
def get_client(
    client_id: int,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Get client profile by ID, scoped to current shop.
    """
    client = session.get(Client, client_id)
    if not client or client.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID {client_id} not found."
        )
    return client


@router.put("/{client_id}", response_model=ClientRead)
def update_client(
    client_id: int,
    client_in: ClientUpdate,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Update client profile details, scoped to current shop.
    """
    client = session.get(Client, client_id)
    if not client or client.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID {client_id} not found."
        )

    if client_in.name is not None:
        client.name = client_in.name.strip()
    if client_in.phone is not None:
        client.phone = client_in.phone.strip()
    if client_in.type is not None:
        client.type = client_in.type
    if client_in.location is not None:
        client.location = client_in.location.strip()

    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: int,
    shop: Shop = Depends(get_current_shop),
    session: Session = Depends(get_session)
):
    """
    Delete client if they have no active orders in current shop.
    """
    client = session.get(Client, client_id)
    if not client or client.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID {client_id} not found."
        )

    if client.orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete client with existing orders. Settle or archive orders first."
        )

    session.delete(client)
    session.commit()
    return None
