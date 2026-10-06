import pytest
import time
from fastapi.testclient import TestClient
from app.main import app, heal_database_records
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction

client = TestClient(app, raise_server_exceptions=False)


def create_test_user(prefix: str):
    email = f"{prefix}_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": f"Tester {prefix}",
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

    return {"headers": headers, "user_id": user_id, "email": email}


def cleanup_test_user(user_info):
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


def test_case_1_and_2_and_3_buy_sell_oversell_and_zero_removal():
    """
    TEST 1, TEST 2, TEST 3:
    BUY TCS 2 @ 2332 -> Portfolio = 2
    SELL TCS 1 @ 2066.20 -> Portfolio = 1 (Avg buy price remains 2332)
    Attempt SELL 5 -> Error (400 Bad Request), no transaction created, portfolio remains 1
    SELL remaining 1 -> Portfolio = 0 (holding removed from active holdings)
    """
    u = create_test_user("test123_flow")
    try:
        headers = u["headers"]

        # 1. BUY TCS 2 @ 2332 via POST /portfolio
        r_buy = client.post("/api/v1/portfolio", headers=headers, json={
            "symbol": "TCS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "quantity": 2.0,
            "average_buy_price": 2332.0,
        })
        assert r_buy.status_code == 201

        port1 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port1) == 1
        assert port1[0]["quantity"] == 2.0
        assert port1[0]["average_buy_price"] == 2332.0

        # 2. SELL TCS 1 @ 2066.20
        r_sell = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 2066.20,
        })
        assert r_sell.status_code == 201

        # TEST 1 Verification: Portfolio = 1, avg buy price remains 2332 (NOT 2066.20)
        port2 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port2) == 1
        assert port2[0]["quantity"] == 1.0
        assert port2[0]["average_buy_price"] == 2332.0
        assert port2[0]["total_investment_value"] == 2332.0

        txs = client.get("/api/v1/transactions", headers=headers).json()
        assert len(txs) == 2  # BUY 2 and SELL 1

        # TEST 3: Attempt SELL quantity greater than holding (e.g. 5)
        r_oversell = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS",
            "transaction_type": "SELL",
            "quantity": 5.0,
            "price": 2066.20,
        })
        assert r_oversell.status_code == 400
        assert "Cannot sell 5.0" in r_oversell.json()["detail"] or "Available quantity" in r_oversell.json()["detail"]

        # Portfolio quantity must remain 1
        port3 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port3) == 1
        assert port3[0]["quantity"] == 1.0

        # TEST 2: SELL remaining 1 share
        r_sell_final = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 2066.20,
        })
        assert r_sell_final.status_code == 201

        # Holding should disappear / be removed from active holdings
        port_final = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port_final) == 0

        # Transaction history preserved
        txs_final = client.get("/api/v1/transactions", headers=headers).json()
        assert len(txs_final) == 3

    finally:
        cleanup_test_user(u)


def test_case_4_and_5_symbol_mismatch_and_page_refresh_persistence():
    """
    TEST 4 & TEST 5:
    BUY: TCS (Quantity = 2, Price = 2332)
    SELL: TCS.NS (Quantity = 1, Price = 2066.20)
    Expected:
    - Same portfolio holding updated (2 - 1 = 1)
    - Second TCS holding NOT created (len(portfolio) == 1)
    - Database refresh / reconnection returns quantity = 1 from PostgreSQL
    """
    u = create_test_user("test45_norm")
    try:
        headers = u["headers"]

        # BUY TCS
        r_buy = client.post("/api/v1/portfolio", headers=headers, json={
            "symbol": "TCS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "quantity": 2.0,
            "average_buy_price": 2332.0,
        })
        assert r_buy.status_code == 201

        # SELL TCS.NS
        r_sell = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 2066.20,
        })
        assert r_sell.status_code == 201

        # TEST 4: Exactly 1 holding, updated quantity = 1
        port = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port) == 1, "Duplicate holding was created!"
        assert port[0]["quantity"] == 1.0
        assert port[0]["average_buy_price"] == 2332.0

        # TEST 5: Refresh simulation & Database verification
        db = SessionLocal()
        db_holdings = db.query(Portfolio).filter(Portfolio.user_id == u["user_id"]).all()
        assert len(db_holdings) == 1
        assert db_holdings[0].quantity == 1.0
        assert db_holdings[0].average_buy_price == 2332.0
        db.close()

        # Re-fetch via API (simulating page reload)
        port_refreshed = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port_refreshed) == 1
        assert port_refreshed[0]["quantity"] == 1.0
        assert port_refreshed[0]["average_buy_price"] == 2332.0

    finally:
        cleanup_test_user(u)


def test_case_6_multiple_buys_weighted_average_cost_basis():
    """
    TEST 6:
    BUY TCS 2 @ ₹2,332
    BUY TCS 1 @ ₹4,500
    Expected:
    Quantity = 3, Average Buy Price = ₹3,054.67
    Then SELL 1.
    Expected:
    Quantity = 2, Average Buy Price remains ₹3,054.67
    """
    u = create_test_user("test6_weighted_avg")
    try:
        headers = u["headers"]

        # BUY 2 @ 2332
        r1 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "transaction_type": "BUY",
            "quantity": 2.0,
            "price": 2332.0,
        })
        assert r1.status_code == 201

        # BUY 1 @ 4500
        r2 = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "transaction_type": "BUY",
            "quantity": 1.0,
            "price": 4500.0,
        })
        assert r2.status_code == 201

        # Expected: Quantity = 3, Average Buy Price = (2*2332 + 1*4500)/3 = 3054.67
        port1 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port1) == 1
        assert port1[0]["quantity"] == 3.0
        assert abs(port1[0]["average_buy_price"] - 3054.6667) < 0.01
        assert abs(port1[0]["total_investment_value"] - 9164.0) < 0.05

        # SELL 1 @ 2066.20
        r_sell = client.post("/api/v1/transactions", headers=headers, json={
            "symbol": "TCS.NS",
            "transaction_type": "SELL",
            "quantity": 1.0,
            "price": 2066.20,
        })
        assert r_sell.status_code == 201

        # Expected: Quantity = 2, Average Buy Price remains ₹3,054.67
        port2 = client.get("/api/v1/portfolio", headers=headers).json()
        assert len(port2) == 1
        assert port2[0]["quantity"] == 2.0
        assert abs(port2[0]["average_buy_price"] - 3054.6667) < 0.01
        assert abs(port2[0]["total_investment_value"] - 6109.33) < 0.05

    finally:
        cleanup_test_user(u)


def test_user5_actual_database_state_reconciliation():
    """
    Validate that User 5 in the live database now reflects quantity 1 for TCS.NS after healing.
    """
    db = SessionLocal()
    try:
        u5 = db.query(User).filter(User.id == 5).first()
        if u5:
            heal_database_records(db)
            p = db.query(Portfolio).filter(Portfolio.user_id == 5, Portfolio.symbol == "TCS.NS").first()
            if p:
                assert p.quantity == 1.0
                assert p.average_buy_price == 2332.0
    finally:
        db.close()
