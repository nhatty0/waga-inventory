from datetime import datetime, time, timedelta, timezone
from fastapi import APIRouter, Depends, Request
import httpx
from sqlmodel import Session, select

from app.config import settings
from app.database import engine, get_session
from app.models import Order, OrderStatus, OrderType, Product, ProductVariant, Shop

router = APIRouter(prefix="/telegram", tags=["Telegram"])
EAT_TZ = timezone(timedelta(hours=3))


def build_shop_digest(shop: Shop, session: Session) -> str:
    """Builds the 8:00 PM Amharic closing summary for a specific subscribed shop."""
    now_eat = datetime.now(EAT_TZ)
    start_of_day_utc = datetime.combine(now_eat.date(), time.min, tzinfo=EAT_TZ).astimezone(timezone.utc)

    todays_orders = session.exec(
        select(Order).where(Order.shop_id == shop.id, Order.created_at >= start_of_day_utc)
    ).all()

    total_sales = sum(o.amount_paid for o in todays_orders if o.order_type != OrderType.INBOUND_MERKATO)
    retail_count = sum(1 for o in todays_orders if o.order_type == OrderType.RETAIL)

    open_loans = session.exec(
        select(Order).where(Order.shop_id == shop.id, Order.status == OrderStatus.PENDING_RETURN)
    ).all()
    open_credits = session.exec(
        select(Order).where(Order.shop_id == shop.id, Order.status == OrderStatus.PARTIALLY_PAID)
    ).all()
    total_receivables = sum(max(0.0, o.total_amount - o.amount_paid) for o in (open_loans + open_credits))

    # Low stock items belonging to this shop
    shop_products = session.exec(select(Product).where(Product.shop_id == shop.id)).all()
    product_map = {p.id: p.name for p in shop_products}
    low_stock_lines = []

    if product_map:
        low_variants = session.exec(
            select(ProductVariant).where(
                ProductVariant.product_id.in_(list(product_map.keys())),
                ProductVariant.stock_quantity <= 3,
            )
        ).all()
        for v in low_variants[:6]:
            low_stock_lines.append(f"• {v.brand} {product_map.get(v.product_id, '')} ({v.spec}) — {v.stock_quantity} ፍሬ")

    low_stock_text = "\n".join(low_stock_lines) if low_stock_lines else "• ሁሉም ዕቃዎች በበቂ ሁኔታ አሉ ✅"

    return (
        f"📊 *{shop.name} — የዕለቱ ማጠቃለያ ({now_eat.strftime('%Y-%m-%d')})*\n\n"
        f"💰 *የዛሬ ገቢ:* {total_sales:,.0f} ብር\n"
        f"🛍️ *የችርቻሮ ሽያጭ ብዛት:* {retail_count} ሽያጮች\n\n"
        f"🤝 *ያልተመለሱ የጎረቤት ውሰቶች:* {len(open_loans)} ዕቃዎች\n"
        f"🧾 *የሚሰበሰብ ቀሪ ዕዳ:* {total_receivables:,.0f} ብር\n\n"
        f"⚠️ *ሊያልቁ የተቃረቡ ዕቃዎች:*\n"
        f"{low_stock_text}"
    )


def broadcast_daily_digests() -> dict:
    """Loops through all active shops with a connected Telegram account and sends their private summary."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return {"sent_count": 0, "reason": "Missing TELEGRAM_BOT_TOKEN"}

    sent_count = 0
    with Session(engine) as session:
        shops = session.exec(
            select(Shop).where(Shop.is_active == True, Shop.telegram_chat_id != None)
        ).all()

        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        for shop in shops:
            msg = build_shop_digest(shop, session)
            try:
                httpx.post(
                    url,
                    json={"chat_id": shop.telegram_chat_id, "text": msg, "parse_mode": "Markdown"},
                    timeout=8.0,
                )
                sent_count += 1
            except Exception:
                continue

    return {"sent_count": sent_count}


@router.post("/webhook")
async def telegram_webhook(request: Request, session: Session = Depends(get_session)):
    """Receives /start shop_<id> from Telegram when a merchant clicks Connect Telegram."""
    data = await request.json()
    message = data.get("message", {})
    text = message.get("text", "")
    chat_id = str(message.get("chat", {}).get("id", ""))

    if text.startswith("/start shop_") and chat_id:
        try:
            shop_id = int(text.replace("/start shop_", "").strip())
            shop = session.get(Shop, shop_id)
            if shop:
                shop.telegram_chat_id = chat_id
                session.add(shop)
                session.commit()

                reply = (
                    f"✅ *{shop.name}* በተሳካ ሁኔታ ተገናኝቷል!\n"
                    f"ከዛሬ ጀምሮ የዕለቱ የሽያጭ እና የዕዳ ማጠቃለያ በየቀኑ ምሽት 2:00 ሰዓት እዚህ ይላክልዎታል።"
                )
                httpx.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={"chat_id": chat_id, "text": reply, "parse_mode": "Markdown"},
                    timeout=5.0,
                )
        except ValueError:
            pass

    return {"ok": True}


@router.post("/test-broadcast")
def test_broadcast_now():
    """Manually trigger the 8:00 PM digest for all connected shops."""
    return broadcast_daily_digests()