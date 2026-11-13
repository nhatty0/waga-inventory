import base64
import hashlib
import hmac
import json
import os
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models import Shop

router = APIRouter(prefix="/auth", tags=["Auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "waga-inventory-secret-key-2026").encode()


def _normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("251") and len(digits) == 12:
        return "0" + digits[3:]
    return digits


def _hash_pin(pin: str) -> str:
    return hashlib.sha256(f"waga_salt_{pin}".encode()).hexdigest()


def _create_token(shop_id: int) -> str:
    payload = json.dumps({"shop_id": shop_id}).encode()
    b64 = base64.urlsafe_b64encode(payload).decode()
    sig = hmac.new(SECRET_KEY, b64.encode(), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"


def _decode_token(token: str) -> Optional[int]:
    try:
        b64, sig = token.split(".", 1)
        expected = hmac.new(SECRET_KEY, b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(base64.urlsafe_b64decode(b64.encode()).decode())
        return int(data["shop_id"])
    except Exception:
        return None


def get_current_shop(
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> Shop:
    """Dependency to identify which merchant shop is making the request."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in with phone and PIN.",
        )
    token = authorization.replace("Bearer ", "").strip()
    shop_id = _decode_token(token)
    if not shop_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")

    shop = session.get(Shop, shop_id)
    if not shop or not shop.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Shop inactive or not found.")
    return shop


# --- Schemas ---
class ShopRegisterRequest(BaseModel):
    shop_name: str = Field(min_length=2)
    location: str = Field(default="Gondar")
    owner_phone: str = Field(min_length=9)
    pin: str = Field(pattern=r"^\d{4}$", description="4-digit numeric PIN")


class ShopLoginRequest(BaseModel):
    owner_phone: str
    pin: str = Field(pattern=r"^\d{4}$")


class AuthResponse(BaseModel):
    access_token: str
    shop_id: int
    shop_name: str
    location: str
    owner_phone: str
    telegram_connected: bool
    telegram_bot_username: str


def _build_auth_response(shop: Shop) -> AuthResponse:
    return AuthResponse(
        access_token=_create_token(shop.id),  # type: ignore
        shop_id=shop.id,  # type: ignore
        shop_name=shop.name,
        location=shop.location,
        owner_phone=shop.owner_phone,
        telegram_connected=bool(shop.telegram_chat_id),
        telegram_bot_username=settings.TELEGRAM_BOT_USERNAME,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_shop(payload: ShopRegisterRequest, session: Session = Depends(get_session)):
    phone = _normalize_phone(payload.owner_phone)
    existing = session.exec(select(Shop).where(Shop.owner_phone == phone)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ይህ ስልክ ቁጥር ቀድሞ ተመዝግቧል። እባክዎ ይግቡ (Phone already registered).",
        )

    shop = Shop(
        name=payload.shop_name.strip(),
        location=payload.location.strip() or "Gondar",
        owner_phone=phone,
        pin_hash=_hash_pin(payload.pin),
    )
    session.add(shop)
    session.commit()
    session.refresh(shop)
    return _build_auth_response(shop)


@router.post("/login", response_model=AuthResponse)
def login_shop(payload: ShopLoginRequest, session: Session = Depends(get_session)):
    phone = _normalize_phone(payload.owner_phone)
    shop = session.exec(select(Shop).where(Shop.owner_phone == phone)).first()
    if not shop or shop.pin_hash != _hash_pin(payload.pin):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="የስልክ ቁጥር ወይም ፒን (PIN) ተሳስቷል።",
        )
    return _build_auth_response(shop)


@router.get("/me", response_model=AuthResponse)
def get_me(shop: Shop = Depends(get_current_shop)):
    return _build_auth_response(shop)