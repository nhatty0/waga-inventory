# Waga Inventory (ዋጋ ኢንቬንቶሪ) Backend

A fast, lightweight inventory tracking and peer-lending management system designed for electronics shops in **Gondar, Ethiopia**.

The shop deals in large electronics (Smart TVs, Fridges, Water Filters) and small appliances (boilers, blenders, decoders, wall mounts). It is built specifically to streamline two high-friction Ethiopian retail workflows:
1. **Inbound freight from Merkato (Addis Ababa) to Gondar**: Track shipments across the 2-3 day transit corridor and seamlessly shift stock from `in_transit_quantity` to shelf `stock_quantity` when trucks arrive in Gondar.
2. **Outbound rural wholesale & peer lending ("Amarech")**: Manage bulk wholesale dispatches to regional shops (e.g., Debark, Dabat) and track short-term inventory borrowing by neighboring shops ("amarech" / peer resell cuts) with automated unreturned item tracking and ledger settlements.

---

## Architecture & Directory Structure

```
backend/
├── app/
│   ├── __init__.py          # Package initialization
│   ├── main.py              # FastAPI application, CORS & lifespan configuration
│   ├── config.py            # Settings (database path, API prefix, CORS origins)
│   ├── database.py          # SQLModel engine, session generator & SQLite pragma setup
│   ├── models.py            # SQLModel database tables (Product, Variant, Client, Order, OrderItem)
│   ├── schemas.py           # Pydantic request/response schemas with computed fields
│   ├── seed.py              # CLI seed script populating realistic Ethiopian inventory & clients
│   └── routers/
│       ├── __init__.py      # Routers package
│       ├── products.py      # Product & nested variant creation, listing & search
│       ├── inventory.py     # Fast delta stock adjustment & Merkato transit receiving
│       ├── clients.py       # Client management (Neighbor borrower, Rural wholesaler, Regular)
│       └── orders.py        # Atomic dispatch transactions & open peer-lending ledger
├── inventory.db             # Local SQLite database file
├── test_waga_inventory.py   # Full integration test suite
├── requirements.txt         # Project dependencies
└── README.md                # Project documentation
```

---

## Tech Stack & Dependencies

- **FastAPI**: Modern, asynchronous web framework with automatic OpenAPI docs.
- **SQLModel**: Pydantic + SQLAlchemy 2.0 ORM by the author of FastAPI.
- **SQLite**: Zero-config, zero-overhead relational database stored in `inventory.db`.
- **Uvicorn**: High-performance ASGI server.
- **Pydantic v2**: High-performance schema validation and serialization.

---

## Quickstart Guide

### 1. Environment Setup

Ensure Python 3.10+ is installed. Activate the virtual environment:

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
source venv/bin/activate
```

Install requirements:
```bash
pip install -r requirements.txt
```

### 2. Seed the Database

Run the seed script to initialize `inventory.db` with realistic categories, variants, clients, and active peer-lending / rural wholesale orders:

```bash
python -m app.seed
```

Seeded items include:
- **3 Categories**: TVs, Kitchen, Accessories.
- **Realistic Variants**:
  - Skyworth 32" HD Smart LED TV
  - Skyworth 43" 4K UHD Smart TV
  - Samsung 55" Crystal UHD 4K Smart TV
  - Geepas Electric Boiler 1.8L Stainless Steel
  - HeavyDuty TV Wall Hangers 32-55" Tilt & Swivel
- **2 Representative Clients**:
  - `Shop 14 Next Door` (`NEIGHBOR_BORROWER`, Gondar Piassa Electronics Row)
  - `Abebe Electronics Debark` (`RURAL_WHOLESALER`, Debark Commercial Center)
- **2 Initial Open Orders**:
  - An open peer-loan (*amarech*) order for a 43" 4K TV borrowed by Shop 14.
  - A partially-paid rural bulk batch dispatched to Debark via minibus.

### 3. Run the Development Server

Start the Uvicorn server:
```bash
uvicorn app.main:app --reload --port 8000
```

The API will be live at:
- **Root**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`

---

## API Reference & Core Business Workflows

### 1. Products & Variants

#### Create Product with Nested Variants
```http
POST /api/products
Content-Type: application/json

{
  "name": "Water Filter & Purifier",
  "category": "Appliances",
  "variants": [
    {
      "brand": "AquaPure",
      "spec": "20L Stainless Steel Gravity Filter",
      "cost_price": 4500.0,
      "retail_price": 6200.0,
      "wholesale_price": 5400.0,
      "stock_quantity": 12,
      "in_transit_quantity": 8
    }
  ]
}
```

#### List Products with Real-Time Stock
```http
GET /api/products?category=TV&search=Skyworth
```
Returns all products grouped with nested variants, along with computed `total_stock` and `total_in_transit`.

---

### 2. Inventory Operations

#### Quick Stock Adjust (Add or Subtract)
```http
POST /api/inventory/adjust
Content-Type: application/json

{
  "variant_id": 1,
  "delta": -2,
  "notes": "Damaged during warehouse rearrangement"
}
```
*Validates that stock never drops below 0.*

#### Receive Inbound Merkato Transit
When the freight truck from Addis Ababa arrives in Gondar, shift quantities from `in_transit_quantity` into `stock_quantity`:
```http
POST /api/inventory/receive-transit
Content-Type: application/json

{
  "variant_id": 1,
  "quantity": 5,
  "notes": "Addis Ababa freight truck arrived at Gondar warehouse"
}
```

---

### 3. Orders & Atomic Dispatch

Dispatches an order atomically in a single database transaction:
- Validates stock availability for every line item.
- Decrements `stock_quantity` immediately.
- Calculates `total_amount`.
- If `amount_paid < total_amount`:
  - `NEIGHBOR_LEND` orders become `PENDING_RETURN`.
  - `RURAL_BULK` / `RETAIL` orders become `PARTIALLY_PAID`.
- If `amount_paid >= total_amount`, status is `COMPLETED`.

#### Dispatch Neighbor Peer-Lend ("Amarech") Order
```http
POST /api/orders/dispatch
Content-Type: application/json

{
  "client_id": 1,
  "order_type": "NEIGHBOR_LEND",
  "items": [
    {
      "variant_id": 2,
      "quantity": 1,
      "unit_price": 34500.0
    }
  ],
  "amount_paid": 0.0,
  "notes": "Neighbor Shop 14 borrowed for walk-in customer demo"
}
```

#### Dispatch Rural Wholesale Bulk Order
```http
POST /api/orders/dispatch
Content-Type: application/json

{
  "client_id": 2,
  "order_type": "RURAL_BULK",
  "items": [
    {
      "variant_id": 1,
      "quantity": 2,
      "unit_price": 17800.0
    },
    {
      "variant_id": 4,
      "quantity": 5,
      "unit_price": 2100.0
    }
  ],
  "amount_paid": 20000.0,
  "notes": "Debark minibus dispatch. Driver: Fasil (Plate 3-12895 AM)"
}
```

---

### 4. Open Ledger & Settlements

#### Get Open Ledger
```http
GET /api/ledger/open
```
Returns all outstanding peer borrowings and wholesale credits, grouped by client:
- Total balance owed per client.
- Outstanding unreturned items aggregated by product variant.
- Open orders list with balance due and item breakdown.
- Global total receivables across Gondar and regional shops.

#### Settle Order: Item Returned (Amarech Returned Unsold)
If a neighbor shop returns the borrowed electronics without selling them, restock the units automatically:
```http
POST /api/ledger/1/settle
Content-Type: application/json

{
  "restock_returned_items": true,
  "notes": "Neighbor returned TV in unopened box"
}
```
*Status is set to `COMPLETED` and variant stock is credited back.*

#### Settle Order: Cash / Mobile Money Payment
Record partial or full payment via CBE Birr, Telebirr, or cash:
```http
POST /api/ledger/2/settle
Content-Type: application/json

{
  "payment_amount": 23000.0,
  "notes": "Paid remainder via Telebirr transaction #TR-994812"
}
```

---

## Running Automated Tests

Run the complete integration test suite:

```bash
python test_waga_inventory.py
```

Tests verify:
- Health checks.
- Nested product and variant creation.
- Negative and positive inventory stock adjustments.
- Merkato transit freight shifting and boundary checking.
- Atomic dispatch transactions with stock decrement.
- Peer lending status transitions (`PENDING_RETURN`).
- Open ledger aggregation and unreturned item calculations.
- Item return restock vs. cash settlement.

---

## Frontend Integration (Next.js)

CORS is pre-configured for:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Configurable in [`app/config.py`](file:///C:/Users/DELL/waga-inventory/backend/app/config.py).
