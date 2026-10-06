import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.portfolio import Portfolio

client = TestClient(app, raise_server_exceptions=False)

@pytest.fixture(autouse=True)
def clean_test_holdings():
    # Login demo user
    r = client.post("/api/v1/auth/login", json={
        "email": "john@example.com",
        "password": "password123"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Cleanup holdings for clean test runs
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.models.transaction import Transaction
        u = db.query(User).filter(User.email == "john@example.com").first()
        if u:
            db.query(Transaction).filter(Transaction.user_id == u.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == u.id).delete()
            db.commit()
    finally:
        db.close()
        
    yield headers

    # Teardown: Clean holdings & transactions
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.models.transaction import Transaction
        u = db.query(User).filter(User.email == "john@example.com").first()
        if u:
            db.query(Transaction).filter(Transaction.user_id == u.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == u.id).delete()
            db.commit()
    finally:
        db.close()


def test_a_create_stock_holding(clean_test_holdings):
    headers = clean_test_holdings
    # TEST A: STOCK
    payload = {
        "symbol": "TCS.NS",
        "asset_type": "Stock",
        "asset_name": "Tata Consultancy Services",
        "quantity": 200.0,
        "average_buy_price": 4250.0
    }
    r = client.post("/api/v1/portfolio", headers=headers, json=payload)
    assert r.status_code == 201, f"Expected 201 Created, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["symbol"] == "TCS.NS"
    assert data["asset_name"] == "Tata Consultancy Services"
    assert data["asset_type"] == "Stock"
    assert data["quantity"] == 200.0
    assert data["average_buy_price"] == 4250.0
    assert data["total_investment_value"] == 850000.0
    assert data["current_price"] > 0
    assert "current_value" in data
    assert "profit_loss" in data

def test_b_create_bond_holding_empty_ticker(clean_test_holdings):
    headers = clean_test_holdings
    # TEST B: BOND
    payload = {
        "symbol": "",
        "asset_type": "Bond",
        "asset_name": "Government Bond",
        "quantity": 150.0,
        "average_buy_price": 1000.0
    }
    r = client.post("/api/v1/portfolio", headers=headers, json=payload)
    assert r.status_code == 201, f"Expected 201 Created, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["symbol"] == ""
    assert data["asset_name"] == "Government Bond"
    assert data["asset_type"] == "Bond"
    assert data["quantity"] == 150.0
    assert data["average_buy_price"] == 1000.0
    assert data["total_investment_value"] == 150000.0
    assert data["current_price"] == 1000.0
    assert data["current_value"] == 150000.0
    assert data["profit_loss"] == 0.0

def test_c_create_invalid_stock_ticker(clean_test_holdings):
    headers = clean_test_holdings
    # TEST C: INVALID STOCK
    payload = {
        "symbol": "INVALIDXYZ123",
        "asset_type": "Stock",
        "asset_name": "Invalid Test",
        "quantity": 10.0,
        "average_buy_price": 100.0
    }
    r = client.post("/api/v1/portfolio", headers=headers, json=payload)
    assert r.status_code == 400, f"Expected 400 Bad Request, got {r.status_code}: {r.text}"
    assert "Invalid market ticker symbol" in r.json()["detail"]

def test_d_unauthenticated_request():
    # TEST D: UNAUTHENTICATED
    payload = {
        "symbol": "TCS.NS",
        "asset_type": "Stock",
        "asset_name": "Tata Consultancy Services",
        "quantity": 200.0,
        "average_buy_price": 4250.0
    }
    r = client.post("/api/v1/portfolio", json=payload)
    assert r.status_code == 401, f"Expected 401 Unauthorized, got {r.status_code}: {r.text}"

def test_portfolio_listing_and_report(clean_test_holdings):
    headers = clean_test_holdings
    # Add stock and bond
    client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_type": "Stock",
        "asset_name": "Tata Consultancy Services",
        "quantity": 200.0,
        "average_buy_price": 4250.0
    })
    client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "",
        "asset_type": "Bond",
        "asset_name": "Government Bond",
        "quantity": 150.0,
        "average_buy_price": 1000.0
    })
    
    # Check GET /portfolio
    r_list = client.get("/api/v1/portfolio", headers=headers)
    assert r_list.status_code == 200
    holdings = r_list.json()
    assert len(holdings) >= 2
    
    # Check GET /report/wealth
    r_report = client.get("/api/v1/report/wealth", headers=headers)
    assert r_report.status_code == 200
    report = r_report.json()
    assert "portfolio" in report
    assert "total_invested" in report
    assert "total_current_value" in report

    # Check Advisor
    r_advisor = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r_advisor.status_code == 200
    
    # Check Notifications
    r_notif = client.get("/api/v1/notifications", headers=headers)
    assert r_notif.status_code == 200
