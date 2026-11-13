import sys
from sqlmodel import Session, select, SQLModel

from app.database import engine, init_db
from app.models import (
    Client,
    ClientType,
    Order,
    OrderItem,
    OrderStatus,
    OrderType,
    Product,
    ProductVariant,
    Shop,
)
from app.routers.auth import _hash_pin


def seed_database(drop_existing: bool = True) -> None:
    """Populate database with initial Ethiopian electronics store seed data for default shop."""
    if drop_existing:
        print("Dropping existing tables for fresh schema...")
        SQLModel.metadata.drop_all(engine)

    print("Initializing database tables...")
    init_db()

    with Session(engine) as session:
        # Create or retrieve default merchant shop (Estif Electronics)
        default_shop = session.exec(select(Shop).where(Shop.owner_phone == "0918112233")).first()
        if not default_shop:
            default_shop = Shop(
                name="Estif Electronics",
                location="Gondar Piassa",
                owner_phone="0918112233",
                pin_hash=_hash_pin("1234"),
            )
            session.add(default_shop)
            session.commit()
            session.refresh(default_shop)

        # Check if already seeded for this shop
        existing_products = session.exec(
            select(Product).where(Product.shop_id == default_shop.id)
        ).first()
        if existing_products and not drop_existing:
            print("Database already contains data for default shop. Skipping seed.")
            return

        print("Seeding Products and Variants...")
        # 1. Product: Smart TVs
        tv_product = Product(shop_id=default_shop.id, name="Smart TV", category="TV")  # type: ignore
        session.add(tv_product)
        session.flush()

        skyworth_32 = ProductVariant(
            product_id=tv_product.id,  # type: ignore
            barcode="6923456789012",
            brand="Skyworth",
            spec='32" HD Smart LED TV',
            cost_price=16000.0,
            retail_price=19500.0,
            wholesale_price=17800.0,
            stock_quantity=10,
            in_transit_quantity=6,
        )
        skyworth_43 = ProductVariant(
            product_id=tv_product.id,  # type: ignore
            barcode="6923456789029",
            brand="Skyworth",
            spec='43" 4K UHD Smart TV',
            cost_price=28500.0,
            retail_price=34500.0,
            wholesale_price=31000.0,
            stock_quantity=7,
            in_transit_quantity=4,
        )
        samsung_55 = ProductVariant(
            product_id=tv_product.id,  # type: ignore
            brand="Samsung",
            spec='55" Crystal UHD 4K Smart TV',
            cost_price=57000.0,
            retail_price=68000.0,
            wholesale_price=62000.0,
            stock_quantity=4,
            in_transit_quantity=2,
        )
        session.add_all([skyworth_32, skyworth_43, samsung_55])

        # 2. Product: Kitchen Appliances
        kitchen_product = Product(
            shop_id=default_shop.id, name="Electric Boiler & Kettle", category="Kitchen"  # type: ignore
        )
        session.add(kitchen_product)
        session.flush()

        geepas_boiler = ProductVariant(
            product_id=kitchen_product.id,  # type: ignore
            barcode="6291101234567",
            brand="Geepas",
            spec="Electric Boiler 1.8L Stainless Steel",
            cost_price=1750.0,
            retail_price=2500.0,
            wholesale_price=2100.0,
            stock_quantity=28,
            in_transit_quantity=15,
        )
        session.add(geepas_boiler)

        # 3. Product: Accessories
        accessories_product = Product(
            shop_id=default_shop.id, name="TV Wall Mounts & Brackets", category="Accessories"  # type: ignore
        )
        session.add(accessories_product)
        session.flush()

        tv_mount = ProductVariant(
            product_id=accessories_product.id,  # type: ignore
            brand="HeavyDuty",
            spec='TV Wall Hangers 32-55" Tilt & Swivel',
            cost_price=750.0,
            retail_price=1400.0,
            wholesale_price=1000.0,
            stock_quantity=45,
            in_transit_quantity=25,
        )
        session.add(tv_mount)

        # 4. Product: Fridges & Freezers
        fridge_product = Product(
            shop_id=default_shop.id, name="Refrigerator & Freezer", category="Fridge"  # type: ignore
        )
        session.add(fridge_product)
        session.flush()

        hitachi_fridge = ProductVariant(
            product_id=fridge_product.id,  # type: ignore
            barcode="8806091234567",
            brand="Hitachi",
            spec="ድርብ በር 350 ሊትር (Double Door 350L)",
            cost_price=58000.0,
            retail_price=72000.0,
            wholesale_price=65000.0,
            stock_quantity=5,
            in_transit_quantity=3,
        )
        lg_fridge = ProductVariant(
            product_id=fridge_product.id,  # type: ignore
            brand="LG",
            spec="260L Smart Inverter No-Frost",
            cost_price=46000.0,
            retail_price=56500.0,
            wholesale_price=51000.0,
            stock_quantity=3,
            in_transit_quantity=2,
        )
        session.add_all([hitachi_fridge, lg_fridge])

        # 5. Product: Water Filter
        filter_product = Product(
            shop_id=default_shop.id, name="Water Filter & Purifier", category="Water Filter"  # type: ignore
        )
        session.add(filter_product)
        session.flush()

        pureit_filter = ProductVariant(
            product_id=filter_product.id,  # type: ignore
            barcode="8901030456789",
            brand="Pureit",
            spec="20 ሊትር (20L Gravity Purifier)",
            cost_price=4500.0,
            retail_price=6200.0,
            wholesale_price=5400.0,
            stock_quantity=14,
            in_transit_quantity=8,
        )
        session.add(pureit_filter)

        # 6. Product: Voltage Stabilizers
        stabilizer_product = Product(
            shop_id=default_shop.id, name="Voltage Stabilizer / Regulator", category="Stabilizer"  # type: ignore
        )
        session.add(stabilizer_product)
        session.flush()

        sollatek_stabilizer = ProductVariant(
            product_id=stabilizer_product.id,  # type: ignore
            barcode="5012345678901",
            brand="Sollatek",
            spec="2000W Automatic Voltage Regulator",
            cost_price=3400.0,
            retail_price=4800.0,
            wholesale_price=4100.0,
            stock_quantity=22,
            in_transit_quantity=12,
        )
        session.add(sollatek_stabilizer)
        session.commit()

        print("Seeding Clients...")
        # Client 1: Neighbor Shop (Peer Borrower - "amarech")
        client_neighbor = Client(
            shop_id=default_shop.id,  # type: ignore
            name="Shop 14 Next Door",
            phone="+251918112233",
            type=ClientType.NEIGHBOR_BORROWER,
            location="Gondar Piassa Electronics Row",
        )
        # Client 2: Rural Wholesaler (Debark)
        client_rural = Client(
            shop_id=default_shop.id,  # type: ignore
            name="Abebe Electronics Debark",
            phone="+251918778899",
            type=ClientType.RURAL_WHOLESALER,
            location="Debark Commercial Center",
        )
        session.add_all([client_neighbor, client_rural])
        session.commit()
        session.refresh(client_neighbor)
        session.refresh(client_rural)

        print("Seeding Open Orders (Amarech Peer-Lend & Rural Bulk Batch)...")
        # 1. Open peer-loan order: Shop 14 borrowed 1 Skyworth 43" 4K TV
        peer_order = Order(
            shop_id=default_shop.id,  # type: ignore
            client_id=client_neighbor.id,
            order_type=OrderType.NEIGHBOR_LEND,
            status=OrderStatus.PENDING_RETURN,
            total_amount=34500.0,
            amount_paid=0.0,
            notes="Solomon borrowed 1 unit for customer inspection / amarech resell cut. Return or cash before 6 PM.",
        )
        session.add(peer_order)
        session.flush()

        peer_item = OrderItem(
            order_id=peer_order.id,  # type: ignore
            variant_id=skyworth_43.id,  # type: ignore
            quantity=1,
            unit_price=34500.0,
        )
        session.add(peer_item)
        # Decrement stock for borrowed item
        skyworth_43.stock_quantity -= 1
        session.add(skyworth_43)

        # 2. Pending rural batch order: Abebe Debark ordered wholesale batch
        # 2x Skyworth 32" @ 17,800 = 35,600
        # 4x Geepas Boiler @ 2,100 = 8,400
        # 4x Wall Mounts @ 1,000 = 4,000
        # Total = 48,000 ETB, Paid advance: 25,000 ETB via CBE, Balance: 23,000 ETB
        rural_order = Order(
            shop_id=default_shop.id,  # type: ignore
            client_id=client_rural.id,
            order_type=OrderType.RURAL_BULK,
            status=OrderStatus.PARTIALLY_PAID,
            total_amount=48000.0,
            amount_paid=25000.0,
            notes="Debark minibus dispatch. Driver: Fasil (Plate 3-12895 AM). Remaining 23,000 ETB balance upon delivery.",
        )
        session.add(rural_order)
        session.flush()

        rural_item_1 = OrderItem(
            order_id=rural_order.id,  # type: ignore
            variant_id=skyworth_32.id,  # type: ignore
            quantity=2,
            unit_price=17800.0,
        )
        rural_item_2 = OrderItem(
            order_id=rural_order.id,  # type: ignore
            variant_id=geepas_boiler.id,  # type: ignore
            quantity=4,
            unit_price=2100.0,
        )
        rural_item_3 = OrderItem(
            order_id=rural_order.id,  # type: ignore
            variant_id=tv_mount.id,  # type: ignore
            quantity=4,
            unit_price=1000.0,
        )
        session.add_all([rural_item_1, rural_item_2, rural_item_3])

        # Decrement stock for rural bulk dispatch
        skyworth_32.stock_quantity -= 2
        geepas_boiler.stock_quantity -= 4
        tv_mount.stock_quantity -= 4
        session.add_all([skyworth_32, geepas_boiler, tv_mount])

        session.commit()
        print("Database successfully seeded with realistic Gondar electronics inventory!")


if __name__ == "__main__":
    drop = "--no-drop" not in sys.argv
    seed_database(drop_existing=drop)
