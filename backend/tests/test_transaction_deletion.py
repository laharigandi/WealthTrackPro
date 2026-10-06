import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def test_user():
    email = f"tx_del_test_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "Delete Test User",
        "email": email,
        "password": "Password123!"
    })
    assert r.status_code == 201

    r_login = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    assert r_login.status_code == 200
    token = r_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    user_id = u.id
    db.close()

    yield {"headers": headers, "user_id": user_id, "email": email}

    # Teardown
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_scenario_1_delete_single_transaction_removes_holding(test_user):
    """TEST 1: Existing TCS.NS BUY 1 @ 4500 -> Delete transaction -> Transaction count = 0, Portfolio holding removed."""
    headers = test_user["headers"]

    # 1. Add BUY transaction
    r_create = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 1.0,
        "price": 4500.0
    })
    assert r_create.status_code == 201
    tx_id = r_create.json()["id"]

    # Verify portfolio has 1 share
    r_port1 = client.get("/api/v1/portfolio", headers=headers)
    assert r_port1.status_code == 200
    assert len(r_port1.json()) == 1
    assert r_port1.json()[0]["quantity"] == 1.0
    assert r_port1.json()[0]["total_investment_value"] == 4500.0

    # 2. Delete the transaction
    r_del = client.delete(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert r_del.status_code == 200
    data = r_del.json()
    assert data["deleted_id"] == tx_id
    assert data["remaining_quantity"] == 0.0

    # 3. Verify transaction logs are empty
    r_txs = client.get("/api/v1/transactions", headers=headers)
    assert r_txs.status_code == 200
    assert len(r_txs.json()) == 0

    # 4. Verify portfolio holding is completely removed
    r_port2 = client.get("/api/v1/portfolio", headers=headers)
    assert r_port2.status_code == 200
    assert len(r_port2.json()) == 0


def test_scenario_2_delete_one_of_multiple_buys(test_user):
    """
    TEST 2:
    Add:
    - TCS.NS BUY 1 @ 4500
    - TCS.NS BUY 2 @ 4000
    Delete second transaction.
    Expected:
    - Remaining transaction: TCS.NS BUY 1 @ 4500
    - Portfolio: Quantity = 1, Invested Value = 4500
    """
    headers = test_user["headers"]

    # 1. Add first transaction
    r1 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 1.0,
        "price": 4500.0
    })
    assert r1.status_code == 201
    tx1_id = r1.json()["id"]

    # 2. Add second transaction
    r2 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 2.0,
        "price": 4000.0
    })
    assert r2.status_code == 201
    tx2_id = r2.json()["id"]

    # Verify combined holding (3 shares @ 4166.67, total 12,500)
    r_port_before = client.get("/api/v1/portfolio", headers=headers)
    assert r_port_before.status_code == 200
    h_before = r_port_before.json()[0]
    assert h_before["quantity"] == 3.0
    assert h_before["total_investment_value"] == 12500.0

    # 3. Delete ONLY the second transaction
    r_del = client.delete(f"/api/v1/transactions/{tx2_id}", headers=headers)
    assert r_del.status_code == 200

    # 4. Verify remaining transaction is tx1
    r_txs = client.get("/api/v1/transactions", headers=headers)
    assert r_txs.status_code == 200
    remaining_txs = r_txs.json()
    assert len(remaining_txs) == 1
    assert remaining_txs[0]["id"] == tx1_id
    assert remaining_txs[0]["quantity"] == 1.0
    assert remaining_txs[0]["price"] == 4500.0

    # 5. Verify portfolio holding recalculated to 1 share @ 4500
    r_port_after = client.get("/api/v1/portfolio", headers=headers)
    assert r_port_after.status_code == 200
    h_after = r_port_after.json()[0]
    assert h_after["quantity"] == 1.0
    assert h_after["average_buy_price"] == 4500.0
    assert h_after["total_investment_value"] == 4500.0


def test_scenario_3_two_transactions_same_symbol_and_price(test_user):
    """TEST 3: Two transactions with same symbol and same price -> Delete one -> Only selected transaction deleted."""
    headers = test_user["headers"]

    # Add two identical transactions
    r1 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "INFY.NS",
        "asset_name": "Infosys",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 10.0,
        "price": 1800.0
    })
    tx1_id = r1.json()["id"]

    r2 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "INFY.NS",
        "asset_name": "Infosys",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 10.0,
        "price": 1800.0
    })
    tx2_id = r2.json()["id"]

    assert tx1_id != tx2_id

    # Delete tx1
    r_del = client.delete(f"/api/v1/transactions/{tx1_id}", headers=headers)
    assert r_del.status_code == 200

    # Verify only tx2 remains
    r_txs = client.get("/api/v1/transactions", headers=headers)
    remaining_ids = [t["id"] for t in r_txs.json()]
    assert tx1_id not in remaining_ids
    assert tx2_id in remaining_ids

    # Verify portfolio has 10 shares remaining
    r_port = client.get("/api/v1/portfolio", headers=headers)
    assert r_port.json()[0]["quantity"] == 10.0
    assert r_port.json()[0]["total_investment_value"] == 18000.0


def test_scenario_4_buy_plus_sell_delete_sell(test_user):
    """TEST 4: BUY 10 + SELL 3 -> Delete SELL transaction -> Portfolio holding restored to 10 shares."""
    headers = test_user["headers"]

    # 1. BUY 10 @ 2000
    r_buy = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "RELIANCE.NS",
        "asset_name": "Reliance",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 10.0,
        "price": 2000.0
    })
    assert r_buy.status_code == 201

    # 2. SELL 3 @ 2200
    r_sell = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "RELIANCE.NS",
        "asset_name": "Reliance",
        "asset_type": "Stock",
        "transaction_type": "SELL",
        "quantity": 3.0,
        "price": 2200.0
    })
    assert r_sell.status_code == 201
    sell_id = r_sell.json()["id"]

    # Verify portfolio has 7 shares
    r_port_mid = client.get("/api/v1/portfolio", headers=headers)
    assert r_port_mid.json()[0]["quantity"] == 7.0

    # 3. Delete the SELL transaction
    r_del = client.delete(f"/api/v1/transactions/{sell_id}", headers=headers)
    assert r_del.status_code == 200

    # 4. Verify portfolio quantity restored to 10
    r_port_final = client.get("/api/v1/portfolio", headers=headers)
    assert r_port_final.json()[0]["quantity"] == 10.0
    assert r_port_final.json()[0]["average_buy_price"] == 2000.0
    assert r_port_final.json()[0]["total_investment_value"] == 20000.0


def test_scenario_5_reject_delete_buy_when_sell_exceeds(test_user):
    """TEST 5: BUY 10 + SELL 8 -> Attempt deleting BUY 10 -> Must be rejected with 400 (would leave negative quantity)."""
    headers = test_user["headers"]

    # 1. BUY 10
    r_buy = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 10.0,
        "price": 4000.0
    })
    buy_id = r_buy.json()["id"]

    # 2. SELL 8
    r_sell = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "SELL",
        "quantity": 8.0,
        "price": 4200.0
    })
    assert r_sell.status_code == 201

    # 3. Attempt deleting the BUY 10 transaction
    r_del = client.delete(f"/api/v1/transactions/{buy_id}", headers=headers)
    assert r_del.status_code == 400
    assert "exceeding available holdings" in r_del.json()["detail"]

    # Verify nothing was deleted
    r_txs = client.get("/api/v1/transactions", headers=headers)
    assert len(r_txs.json()) == 2
    r_port = client.get("/api/v1/portfolio", headers=headers)
    assert r_port.json()[0]["quantity"] == 2.0


def test_scenario_6_user_isolation(test_user):
    """TEST 6: User A cannot delete User B's transaction."""
    headers_a = test_user["headers"]

    # Create transaction for User A
    r_tx = client.post("/api/v1/transactions", headers=headers_a, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 5.0,
        "price": 4000.0
    })
    tx_id = r_tx.json()["id"]

    # Create User B
    email_b = f"user_b_{int(time.time() * 1000)}@example.com"
    client.post("/api/v1/auth/register", json={
        "name": "User B",
        "email": email_b,
        "password": "Password123!"
    })
    r_login_b = client.post("/api/v1/auth/login", json={
        "email": email_b,
        "password": "Password123!"
    })
    token_b = r_login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempts to delete User A's transaction
    r_del = client.delete(f"/api/v1/transactions/{tx_id}", headers=headers_b)
    assert r_del.status_code == 404, "User B should not be able to delete User A's transaction."

    # Verify User A's transaction still exists
    r_check = client.get("/api/v1/transactions", headers=headers_a)
    assert len(r_check.json()) == 1

    # Cleanup User B
    db = SessionLocal()
    u_b = db.query(User).filter(User.email == email_b).first()
    if u_b:
        db.delete(u_b)
        db.commit()
    db.close()
