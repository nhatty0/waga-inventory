"""Integration tests for Waga Inventory backend with multi-tenant shop isolation."""
from fastapi.testclient import TestClient
from app.main import app
from app.seed import seed_database


def test_full_workflow():
    # 1. Reset and reseed DB (creates default shop: Estif Electronics, 0918112233 / 1234)
    seed_database(drop_existing=True)

    with TestClient(app) as client:
        # Check health
        health_res = client.get("/api/health")
        assert health_res.status_code == 200
        assert health_res.json()["status"] == "healthy"

        # -----------------------------------------------------------
        # Test 0: Auth & Token Validation
        # -----------------------------------------------------------
        # Unauthenticated request must return 401
        unauth_res = client.get("/api/products")
        assert unauth_res.status_code == 401

        # Login as default shop
        login_res = client.post("/api/auth/login", json={
            "owner_phone": "0918112233",
            "pin": "1234",
        })
        assert login_res.status_code == 200
        auth_data = login_res.json()
        token = auth_data["access_token"]
        assert token
        headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] Test 0: Auth & Token Generation passed")

        # -----------------------------------------------------------
        # Test 1: GET /api/products
        # -----------------------------------------------------------
        products_res = client.get("/api/products", headers=headers)
        assert products_res.status_code == 200
        products = products_res.json()
        assert len(products) >= 3
        # Check nested variants and computed totals
        smart_tv = next(p for p in products if p["name"] == "Smart TV")
        assert smart_tv["category"] == "TV"
        assert len(smart_tv["variants"]) == 3
        assert "total_stock" in smart_tv
        assert "total_in_transit" in smart_tv
        print("[PASS] Test 1: GET /api/products passed (products grouped with variants & stock)")

        # -----------------------------------------------------------
        # Test 2: POST /api/products (Create with nested variants)
        # -----------------------------------------------------------
        new_prod_payload = {
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
                    "in_transit_quantity": 8,
                }
            ],
        }
        create_prod_res = client.post("/api/products", json=new_prod_payload, headers=headers)
        assert create_prod_res.status_code == 201
        created_prod = create_prod_res.json()
        assert created_prod["name"] == "Water Filter & Purifier"
        assert len(created_prod["variants"]) == 1
        created_variant_id = created_prod["variants"][0]["id"]
        assert created_prod["variants"][0]["stock_quantity"] == 12
        print("[PASS] Test 2: POST /api/products with nested variants passed")

        # -----------------------------------------------------------
        # Test 3: POST /api/inventory/adjust
        # -----------------------------------------------------------
        # Positive adjustment
        adjust_pos = client.post("/api/inventory/adjust", json={
            "variant_id": created_variant_id,
            "delta": 5,
            "notes": "Restock from secondary shelf"
        }, headers=headers)
        assert adjust_pos.status_code == 200
        assert adjust_pos.json()["new_stock"] == 17

        # Negative adjustment
        adjust_neg = client.post("/api/inventory/adjust", json={
            "variant_id": created_variant_id,
            "delta": -2,
            "notes": "Damaged filter cartridge"
        }, headers=headers)
        assert adjust_neg.status_code == 200
        assert adjust_neg.json()["new_stock"] == 15

        # Invalid adjustment below 0
        adjust_invalid = client.post("/api/inventory/adjust", json={
            "variant_id": created_variant_id,
            "delta": -100
        }, headers=headers)
        assert adjust_invalid.status_code == 400
        assert "Cannot reduce stock by 100" in adjust_invalid.json()["detail"]
        print("[PASS] Test 3: POST /api/inventory/adjust passed (bounds and validation)")

        # -----------------------------------------------------------
        # Test 4: POST /api/inventory/receive-transit (Merkato arrival)
        # -----------------------------------------------------------
        # Initially in_transit_quantity is 8, stock is 15
        receive_res = client.post("/api/inventory/receive-transit", json={
            "variant_id": created_variant_id,
            "quantity": 5,
            "notes": "Truck from Merkato arrived at Piassa shop"
        }, headers=headers)
        assert receive_res.status_code == 200
        data = receive_res.json()
        assert data["new_in_transit"] == 3  # 8 - 5 = 3
        assert data["new_stock"] == 20       # 15 + 5 = 20

        # Try receiving more than remaining in transit (3)
        receive_excess = client.post("/api/inventory/receive-transit", json={
            "variant_id": created_variant_id,
            "quantity": 10
        }, headers=headers)
        assert receive_excess.status_code == 400
        assert "Only 3 units are currently marked in-transit" in receive_excess.json()["detail"]
        print("[PASS] Test 4: POST /api/inventory/receive-transit passed (Merkato freight shift)")

        # -----------------------------------------------------------
        # Test 5: POST /api/orders/dispatch (Atomic transaction)
        # -----------------------------------------------------------
        # Find the neighbor client (Shop 14 Next Door)
        clients_res = client.get("/api/clients", headers=headers)
        assert clients_res.status_code == 200
        clients = clients_res.json()
        neighbor = next(c for c in clients if c["type"] == "NEIGHBOR_BORROWER")

        # Check variant stock before dispatch
        current_stock = client.get(f"/api/products/{created_prod['id']}", headers=headers).json()["variants"][0]["stock_quantity"]
        assert current_stock == 20

        # Insufficient stock test
        insufficient_dispatch = client.post("/api/orders/dispatch", json={
            "client_id": neighbor["id"],
            "order_type": "NEIGHBOR_LEND",
            "items": [{"variant_id": created_variant_id, "quantity": 999, "unit_price": 6200.0}],
            "amount_paid": 0.0,
        }, headers=headers)
        assert insufficient_dispatch.status_code == 400
        assert "Insufficient stock" in insufficient_dispatch.json()["detail"]

        # Successful peer loan dispatch (NEIGHBOR_LEND, amount_paid=0 -> status PENDING_RETURN)
        peer_dispatch = client.post("/api/orders/dispatch", json={
            "client_id": neighbor["id"],
            "order_type": "NEIGHBOR_LEND",
            "items": [{"variant_id": created_variant_id, "quantity": 2, "unit_price": 6200.0}],
            "amount_paid": 0.0,
            "notes": "Amarech for customer demo"
        }, headers=headers)
        assert peer_dispatch.status_code == 201
        order_data = peer_dispatch.json()
        assert order_data["status"] == "PENDING_RETURN"
        assert order_data["total_amount"] == 12400.0
        assert order_data["amount_paid"] == 0.0
        assert order_data["balance_due"] == 12400.0
        new_peer_order_id = order_data["id"]

        # Verify stock was decremented from 20 to 18
        stock_after = client.get(f"/api/products/{created_prod['id']}", headers=headers).json()["variants"][0]["stock_quantity"]
        assert stock_after == 18
        print("[PASS] Test 5: POST /api/orders/dispatch passed (stock decrement & PENDING_RETURN status)")

        # -----------------------------------------------------------
        # Test 6: GET /api/ledger/open
        # -----------------------------------------------------------
        ledger_res = client.get("/api/ledger/open", headers=headers)
        assert ledger_res.status_code == 200
        ledger = ledger_res.json()
        assert ledger["total_receivables"] > 0
        assert ledger["total_open_orders"] >= 2
        # Check that neighbor group has unreturned items and total owed
        neighbor_group = next(g for g in ledger["clients"] if g["client"]["id"] == neighbor["id"])
        assert neighbor_group["total_owed"] > 0
        assert len(neighbor_group["orders"]) >= 2
        assert len(neighbor_group["unreturned_items"]) >= 1
        print("[PASS] Test 6: GET /api/ledger/open passed (outstanding credits & unreturned items)")

        # -----------------------------------------------------------
        # Test 7: POST /api/ledger/{order_id}/settle
        # -----------------------------------------------------------
        # Settle by returning items back to shelf stock (restock_returned_items=True)
        settle_return_res = client.post(f"/api/ledger/{new_peer_order_id}/settle", json={
            "restock_returned_items": True,
            "notes": "Neighbor returned both water filters in original packaging"
        }, headers=headers)
        assert settle_return_res.status_code == 200
        settled_order = settle_return_res.json()
        assert settled_order["status"] == "COMPLETED"

        # Verify stock was restored from 18 back to 20
        stock_restored = client.get(f"/api/products/{created_prod['id']}", headers=headers).json()["variants"][0]["stock_quantity"]
        assert stock_restored == 20

        # Now test cash settlement on the seeded rural order
        rural = next(c for c in clients if c["type"] == "RURAL_WHOLESALER")
        rural_ledger = next(g for g in client.get("/api/ledger/open", headers=headers).json()["clients"] if g["client"]["id"] == rural["id"])
        rural_order_id = rural_ledger["orders"][0]["id"]
        rem_balance = rural_ledger["orders"][0]["balance_due"]
        assert rem_balance > 0

        settle_cash_res = client.post(f"/api/ledger/{rural_order_id}/settle", json={
            "payment_amount": rem_balance,
            "notes": "Paid remainder via Telebirr receipt #TR-88192"
        }, headers=headers)
        assert settle_cash_res.status_code == 200
        assert settle_cash_res.json()["status"] == "COMPLETED"
        assert settle_cash_res.json()["balance_due"] == 0.0
        print("[PASS] Test 7: POST /api/ledger/{order_id}/settle passed (item return restock & cash settlement)")

        # -----------------------------------------------------------
        # Test 8: PUT /api/products/variants/{variant_id} (Full Edit)
        # -----------------------------------------------------------
        update_res = client.put(f"/api/products/variants/{created_variant_id}", json={
            "brand": "AquaPure Pro",
            "spec": "25L Upgraded Stainless Filter",
            "product_name": "Premium Water Filter",
            "stock_quantity": 15,
            "in_transit_quantity": 10,
            "retail_price": 6800.0,
            "wholesale_price": 5900.0,
        }, headers=headers)
        assert update_res.status_code == 200
        updated_variant = update_res.json()
        assert updated_variant["brand"] == "AquaPure Pro"
        assert updated_variant["spec"] == "25L Upgraded Stainless Filter"
        assert updated_variant["stock_quantity"] == 15
        assert updated_variant["retail_price"] == 6800.0

        # Verify parent product name updated
        prod_check = client.get(f"/api/products/{created_prod['id']}", headers=headers).json()
        assert prod_check["name"] == "Premium Water Filter"
        print("[PASS] Test 8: PUT /api/products/variants/{id} passed (full variant & name editing)")

        # -----------------------------------------------------------
        # Test 9: GET /api/inventory/barcode/{code} (Scan Lookup)
        # -----------------------------------------------------------
        barcode_res = client.get("/api/inventory/barcode/6923456789012", headers=headers)
        assert barcode_res.status_code == 200
        bc_data = barcode_res.json()
        assert bc_data["variant"]["brand"] == "Skyworth"
        assert bc_data["product_name"] == "Smart TV"

        not_found_res = client.get("/api/inventory/barcode/9999999999999", headers=headers)
        assert not_found_res.status_code == 404

        # Update variant barcode and re-verify
        update_bc_res = client.put(f"/api/products/variants/{created_variant_id}", json={
            "barcode": "7778889991112"
        }, headers=headers)
        assert update_bc_res.status_code == 200
        assert update_bc_res.json()["barcode"] == "7778889991112"

        new_bc_lookup = client.get("/api/inventory/barcode/7778889991112", headers=headers)
        assert new_bc_lookup.status_code == 200
        assert new_bc_lookup.json()["variant"]["id"] == created_variant_id
        print("[PASS] Test 9: GET /api/inventory/barcode/{code} passed (barcode lookup & registration)")

        # -----------------------------------------------------------
        # Test 10: Multi-Tenant Shop Isolation Verification
        # -----------------------------------------------------------
        # Register a second distinct merchant shop (Shop B)
        reg_b_res = client.post("/api/auth/register", json={
            "shop_name": "Gondar Solar & Mobile",
            "location": "Azezo Market",
            "owner_phone": "0918999888",
            "pin": "5555"
        })
        assert reg_b_res.status_code == 201
        token_b = reg_b_res.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Shop B must NOT see Shop A's products, clients, or orders
        shop_b_products = client.get("/api/products", headers=headers_b).json()
        assert len(shop_b_products) == 0

        shop_b_clients = client.get("/api/clients", headers=headers_b).json()
        assert len(shop_b_clients) == 0

        shop_b_orders = client.get("/api/orders", headers=headers_b).json()
        assert len(shop_b_orders) == 0

        shop_b_ledger = client.get("/api/ledger/open", headers=headers_b).json()
        assert shop_b_ledger["total_receivables"] == 0.0
        assert len(shop_b_ledger["clients"]) == 0

        # Shop B cannot access or alter Shop A's variant or order by ID
        cross_prod_res = client.get(f"/api/products/{created_prod['id']}", headers=headers_b)
        assert cross_prod_res.status_code == 404

        cross_adjust_res = client.post("/api/inventory/adjust", json={
            "variant_id": created_variant_id,
            "delta": 10
        }, headers=headers_b)
        assert cross_adjust_res.status_code == 404

        cross_barcode_res = client.get("/api/inventory/barcode/7778889991112", headers=headers_b)
        assert cross_barcode_res.status_code == 404

        cross_settle_res = client.post(f"/api/ledger/{new_peer_order_id}/settle", json={
            "restock_returned_items": True
        }, headers=headers_b)
        assert cross_settle_res.status_code == 404
        print("[PASS] Test 10: Multi-tenant shop isolation strictly verified (zero data leakage between shops)")

    print("\n>>> ALL WAGA INVENTORY INTEGRATION TESTS PASSED! <<<")


if __name__ == "__main__":
    test_full_workflow()
