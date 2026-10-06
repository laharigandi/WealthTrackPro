import pytest
import time
from fastapi.testclient import TestClient
from app.main import app, heal_database_records
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def fresh_user():
    email = f"sell_sync_test_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "Sell Sync Tester",
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


def test_scenario_exact_user_case(fresh_user):
    """
    EXACT USER BUG CASE:
    TCS.NS:
    - BUY 1 @ 4,500
    - BUY 2 @ 2,332
    - SELL 1 @ 2,348

    Expected:
    - Quantity = 2
    - Average Buy Price = 3054.67 (weighted-average)
    - Invested Value = 6109.33
    - Current Value = 2 * current_live_market_price (NOT sell price 2348)
    - P/L = Current Value - Invested Value
    - SELL must NOT set holding to zero.
    """
    headers = fresh_user["headers"]

    # 1. BUY 1 @ 4500
    r1 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 1.0,
        "price": 4500.0,
    })
    assert r1.status_code == 201

    # 2. BUY 2 @ 2332
    r2 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 2.0,
        "price": 2332.0,
    })
    assert r2.status_code == 201

    # Verify portfolio before SELL
    r_port_before = client.get("/api/v1/portfolio", headers=headers)
    assert r_port_before.status_code == 200
    holdings_before = r_port_before.json()
    assert len(holdings_before) == 1
    h_before = holdings_before[0]
    assert h_before["symbol"] == "TCS.NS"
    assert h_before["quantity"] == 3.0
    assert abs(h_before["average_buy_price"] - 3054.6667) < 0.01
    assert abs(h_before["total_investment_value"] - 9164.0) < 0.05

    # 3. SELL 1 @ 2348
    r_sell1 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2348.0,
    })
    assert r_sell1.status_code == 201

    # Verify portfolio after SELL 1
    r_port_after = client.get("/api/v1/portfolio", headers=headers)
    assert r_port_after.status_code == 200
    holdings_after = r_port_after.json()
    assert len(holdings_after) == 1
    h_after = holdings_after[0]

    # Critical assertions
    assert h_after["quantity"] == 2.0, f"Expected quantity 2.0, got {h_after['quantity']}"
    assert abs(h_after["average_buy_price"] - 3054.6667) < 0.01
    assert abs(h_after["total_investment_value"] - 6109.33) < 0.05

    # Current market value and profit/loss calculated from live price
    if h_after["current_price"] is not None:
        expected_curr_val = round(2.0 * h_after["current_price"], 2)
        assert abs(h_after["current_value"] - expected_curr_val) < 0.05
        expected_pnl = round(expected_curr_val - 6109.33, 2)
        assert abs(h_after["profit_loss"] - expected_pnl) < 0.05

    # 4. SELL 1 -> Quantity = 1
    r_sell2 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2348.0,
    })
    assert r_sell2.status_code == 201
    h_after2 = client.get("/api/v1/portfolio", headers=headers).json()[0]
    assert h_after2["quantity"] == 1.0
    assert abs(h_after2["total_investment_value"] - 3054.67) < 0.05

    # 5. SELL 1 -> Quantity = 0 -> Holding removed
    r_sell3 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2348.0,
    })
    assert r_sell3.status_code == 201
    holdings_after3 = client.get("/api/v1/portfolio", headers=headers).json()
    assert len(holdings_after3) == 0, "Holding should be removed when quantity reaches 0"

    # All 5 transactions must be intact in transaction history
    txs = client.get("/api/v1/transactions", headers=headers).json()
    assert len(txs) == 5

    # 6. SELL 1 -> Insufficient quantity error (400)
    r_excess = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2348.0,
    })
    assert r_excess.status_code == 400
    assert "Cannot sell" in r_excess.json()["detail"] or "Available quantity" in r_excess.json()["detail"] or "Insufficient portfolio quantity" in r_excess.json()["detail"]


def test_scenario_selling_2_of_3(fresh_user):
    """Selling 2 of 3 leaves 1 share."""
    headers = fresh_user["headers"]

    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "BUY",
        "quantity": 3.0,
        "price": 3000.0,
    })
    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "SELL",
        "quantity": 2.0,
        "price": 3500.0,
    })

    port = client.get("/api/v1/portfolio", headers=headers).json()
    assert len(port) == 1
    assert port[0]["quantity"] == 1.0
    assert port[0]["average_buy_price"] == 3000.0
    assert port[0]["total_investment_value"] == 3000.0


def test_scenario_delete_sell_restores_holding(fresh_user):
    """BUY 3 + SELL 1 -> Delete SELL transaction -> Holding quantity restored to 3."""
    headers = fresh_user["headers"]

    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "INFY.NS",
        "transaction_type": "BUY",
        "quantity": 3.0,
        "price": 1500.0,
    })
    r_sell = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "INFY.NS",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 1600.0,
    })
    sell_id = r_sell.json()["id"]

    # Verify quantity is 2
    port_mid = client.get("/api/v1/portfolio", headers=headers).json()
    assert port_mid[0]["quantity"] == 2.0

    # Delete the SELL transaction
    r_del = client.delete(f"/api/v1/transactions/{sell_id}", headers=headers)
    assert r_del.status_code == 200

    # Verify quantity restored to 3
    port_final = client.get("/api/v1/portfolio", headers=headers).json()
    assert port_final[0]["quantity"] == 3.0
    assert port_final[0]["average_buy_price"] == 1500.0


def test_scenario_ai_rebalancing_and_report_sync(fresh_user):
    """Verify AI rebalancing and wealth report accurately reflect active holdings after SELL."""
    headers = fresh_user["headers"]

    # Add 2 assets
    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "BUY",
        "quantity": 3.0,
        "price": 4000.0,
    })
    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "RELIANCE.NS",
        "transaction_type": "BUY",
        "quantity": 2.0,
        "price": 2500.0,
    })

    # Sell all RELIANCE.NS
    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "RELIANCE.NS",
        "transaction_type": "SELL",
        "quantity": 2.0,
        "price": 2600.0,
    })

    # Sell 1 TCS.NS
    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 4100.0,
    })

    # Verify Advisor only sees remaining 2 TCS.NS
    r_adv = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r_adv.status_code == 200
    adv = r_adv.json()
    assert adv["total_portfolio_value"] > 0

    # Verify Wealth Report
    r_rep = client.get("/api/v1/report/wealth", headers=headers)
    assert r_rep.status_code == 200
    rep = r_rep.json()
    assert len(rep["portfolio"]) == 1
    assert rep["portfolio"][0]["symbol"] == "TCS.NS"
    assert rep["portfolio"][0]["quantity"] == 2.0
    assert rep["portfolio"][0]["invested_value"] == 8000.0


def test_scenario_database_heal_preserves_state(fresh_user):
    """Verify database auto-healing reconciliation preserves correct portfolio state."""
    headers = fresh_user["headers"]

    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "BUY",
        "quantity": 1.0,
        "price": 4500.0,
    })
    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "BUY",
        "quantity": 2.0,
        "price": 2332.0,
    })
    client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2348.0,
    })

    # Run database heal
    db = SessionLocal()
    heal_database_records(db)
    db.close()

    # Verify portfolio state preserved
    port = client.get("/api/v1/portfolio", headers=headers).json()
    assert len(port) == 1
    assert port[0]["quantity"] == 2.0
    assert abs(port[0]["average_buy_price"] - 3054.6667) < 0.01
