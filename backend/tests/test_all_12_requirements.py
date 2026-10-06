import pytest
import time
from fastapi.testclient import TestClient
from app.main import app, heal_database_records
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction

client = TestClient(app, raise_server_exceptions=False)


def create_test_user(prefix: str = "test_user"):
    email = f"{prefix}_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "WealthTrack Tester",
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

    return {"headers": headers, "user_id": user_id, "email": email, "password": "Password123!"}


def cleanup_user(user_info):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_info["user_id"]).first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_testcases_1_to_5_tcs_lifecycle():
    """
    Test Cases 1-5:
    1. BUY TCS.NS quantity 2 -> holding quantity = 2
    2. BUY TCS.NS quantity 1 -> holding quantity = 3 -> one holding only with weighted avg
    3. SELL TCS.NS quantity 1 -> holding quantity = 2 with avg price preserved
    4. SELL TCS.NS quantity 2 -> holding quantity = 0
    5. SELL TCS.NS quantity 1 when quantity = 0 -> reject transaction -> no database modification
    """
    u = create_test_user("tc_1_5")
    headers = u["headers"]
    try:
        # Test Case 1: BUY TCS.NS quantity 2 @ ₹3,000 -> holding quantity = 2
        r1 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "BUY",
            "quantity": 2.0,
            "price": 3000.0,
        })
        assert r1.status_code == 201
        port1 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port1) == 1
        assert port1[0]["symbol"] == "TCS.NS"
        assert port1[0]["quantity"] == 2.0
        assert port1[0]["average_buy_price"] == 3000.0

        # Test Case 2: BUY TCS.NS quantity 1 @ ₹2,500 -> holding quantity = 3 -> one holding only
        # Formula: ((2 * 3000) + (1 * 2500)) / 3 = 8500 / 3 = 2833.3333...
        r2 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "BUY",
            "quantity": 1.0,
            "price": 2500.0,
        })
        assert r2.status_code == 201
        port2 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port2) == 1, "Must maintain only one holding record per asset"
        assert port2[0]["quantity"] == 3.0
        assert abs(port2[0]["average_buy_price"] - 2833.3333) < 0.01

        # Test Case 3: SELL TCS.NS quantity 1 @ ₹2,348 -> holding quantity = 2, avg price preserved
        r3 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 2348.0,
        })
        assert r3.status_code == 201
        port3 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port3) == 1
        assert port3[0]["quantity"] == 2.0
        assert abs(port3[0]["average_buy_price"] - 2833.3333) < 0.01

        # Test Case 4: SELL TCS.NS quantity 2 @ ₹2,348 -> holding quantity = 0
        r4 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "SELL",
            "quantity": 2.0,
            "price": 2348.0,
        })
        assert r4.status_code == 201
        port4 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port4) == 0, "Holding quantity reached 0; active portfolio should be empty"

        # Test Case 5: SELL TCS.NS quantity 1 when quantity = 0 -> reject transaction -> no database modification
        tx_count_before = len(client.get("/api/v1/transactions", headers=headers).json())
        r5 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 2348.0,
        })
        assert r5.status_code == 400
        assert "Cannot sell 1.0 TCS.NS. Available quantity: 0" in r5.json()["detail"] or "Available quantity: 0" in r5.json()["detail"]
        tx_count_after = len(client.get("/api/v1/transactions", headers=headers).json())
        assert tx_count_after == tx_count_before, "No transaction should be created on rejected sell"

    finally:
        cleanup_user(u)


def test_testcase_6_sell_unowned_asset_rejected():
    """
    Test Case 6:
    SELL RELIANCE.NS when no RELIANCE.NS holding exists -> rejected safely with HTTP 400.
    """
    u = create_test_user("tc_6")
    headers = u["headers"]
    try:
        # User has no RELIANCE.NS holding
        r = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "RELIANCE.NS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 2980.0,
        })
        assert r.status_code == 400
        assert "Cannot sell" in r.json()["detail"] or "Available quantity: 0" in r.json()["detail"]
    finally:
        cleanup_user(u)


def test_testcases_7_and_8_symbol_normalization():
    """
    Test Case 7: BUY "tcs.ns" -> normalize to TCS.NS
    Test Case 8: BUY " TCS.NS " -> normalize to TCS.NS
    Both merge into the same canonical holding.
    """
    u = create_test_user("tc_7_8")
    headers = u["headers"]
    try:
        # Test Case 7: BUY "tcs.ns"
        r1 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "tcs.ns",
            "transaction_type": "BUY",
            "quantity": 1.0,
            "price": 3000.0,
        })
        assert r1.status_code == 201

        # Test Case 8: BUY " TCS.NS "
        r2 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "  TCS.NS  ",
            "transaction_type": "BUY",
            "quantity": 2.0,
            "price": 3000.0,
        })
        assert r2.status_code == 201

        # Check holding
        port = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port) == 1, "Normalized symbols must merge into one holding"
        assert port[0]["symbol"] == "TCS.NS"
        assert port[0]["quantity"] == 3.0
    finally:
        cleanup_user(u)


def test_testcase_9_delete_sell_transaction_restores_quantity():
    """
    Test Case 9:
    BUY 3 TCS -> SELL 1 TCS (qty becomes 2) -> Delete SELL transaction -> portfolio quantity correctly restored to 3.
    """
    u = create_test_user("tc_9")
    headers = u["headers"]
    try:
        client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "BUY",
            "quantity": 3.0,
            "price": 3000.0,
        })
        r_sell = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 3200.0,
        })
        assert r_sell.status_code == 201
        sell_id = r_sell.json()["id"]

        # Check quantity is 2
        port_mid = client.get("/api/v1/portfolio", headers=headers).json()
        assert port_mid[0]["quantity"] == 2.0

        # Delete SELL transaction
        r_del = client.delete(f"/api/v1/transactions/{sell_id}", headers=headers)
        assert r_del.status_code == 200

        # Check quantity is restored to 3
        port_after = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port_after) == 1
        assert port_after[0]["quantity"] == 3.0
        assert port_after[0]["average_buy_price"] == 3000.0
    finally:
        cleanup_user(u)


def test_testcase_10_and_11_refresh_and_relogin_consistency():
    """
    Test Case 10: Refresh page / fetch after BUY/SELL -> portfolio, advisor, and transaction history remain consistent.
    Test Case 11: Logout and login again -> same correct portfolio data appears.
    """
    u = create_test_user("tc_10_11")
    headers = u["headers"]
    email = u["email"]
    password = u["password"]
    try:
        # BUY 3 TCS.NS
        client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "BUY",
            "quantity": 3.0,
            "price": 3000.0,
        })
        # SELL 1 TCS.NS
        client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 3100.0,
        })

        # Test Case 10: Check consistency across portfolio, advisor, and transaction endpoints
        port = client.get("/api/v1/portfolio", headers=headers).json()
        txs = client.get("/api/v1/transactions", headers=headers).json()
        adv = client.get("/api/v1/advisor/rebalancing", headers=headers).json()

        assert len(port) == 1
        assert port[0]["quantity"] == 2.0
        assert len(txs) == 2
        assert adv["total_portfolio_value"] > 0

        # Test Case 11: Re-login (simulate logout/login)
        r_login = client.post("/api/v1/auth/login", json={
            "email": email,
            "password": password
        })
        assert r_login.status_code == 200
        new_token = r_login.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # Check identical portfolio data
        new_port = client.get("/api/v1/portfolio", headers=new_headers).json()
        new_txs = client.get("/api/v1/transactions", headers=new_headers).json()

        assert len(new_port) == 1
        assert new_port[0]["symbol"] == "TCS.NS"
        assert new_port[0]["quantity"] == 2.0
        assert len(new_txs) == 2
    finally:
        cleanup_user(u)


def test_testcase_12_user_isolation():
    """
    Test Case 12:
    Two different users have TCS.NS -> each user sees and modifies only their own quantity.
    """
    u1 = create_test_user("user_a")
    u2 = create_test_user("user_b")
    headers1 = u1["headers"]
    headers2 = u2["headers"]
    try:
        # User 1 buys 5 TCS.NS
        client.post("/api/v1/transactions", headers=headers1, json={
            "symbol": "TCS.NS",
            "transaction_type": "BUY",
            "quantity": 5.0,
            "price": 3000.0,
        })

        # User 2 buys 2 TCS.NS
        client.post("/api/v1/transactions", headers=headers2, json={
            "symbol": "TCS.NS",
            "transaction_type": "BUY",
            "quantity": 2.0,
            "price": 3000.0,
        })

        # Verify User 1 sees quantity 5
        port1 = client.get("/api/v1/portfolio", headers=headers1).json()
        assert len(port1) == 1
        assert port1[0]["quantity"] == 5.0

        # Verify User 2 sees quantity 2
        port2 = client.get("/api/v1/portfolio", headers=headers2).json()
        assert len(port2) == 1
        assert port2[0]["quantity"] == 2.0

        # User 2 sells 1 TCS.NS -> User 2 quantity becomes 1, User 1 quantity must remain 5
        r_sell2 = client.post("/api/v1/transactions", headers=headers2, json={
            "symbol": "TCS.NS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 3100.0,
        })
        assert r_sell2.status_code == 201

        port1_after = client.get("/api/v1/portfolio", headers=headers1).json()
        port2_after = client.get("/api/v1/portfolio", headers=headers2).json()

        assert port1_after[0]["quantity"] == 5.0, "User 1 holdings must not be affected by User 2 actions"
        assert port2_after[0]["quantity"] == 1.0, "User 2 holdings must reflect their own sell"

    finally:
        cleanup_user(u1)
        cleanup_user(u2)
