import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.portfolio import Portfolio
from app.models.user import User
from app.api.v1.advisor import _portfolio_risk_level, _generate_recommendations, TARGET_ALLOCATIONS

client = TestClient(app, raise_server_exceptions=False)

@pytest.fixture(autouse=True)
def setup_user_and_clean_holdings():
    # Login demo user
    r = client.post("/api/v1/auth/login", json={
        "email": "john@example.com",
        "password": "password123"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Set risk profile to Moderate
    r_risk = client.patch("/api/v1/users/me/risk-profile", headers=headers, json={"risk_profile": "moderate"})
    assert r_risk.status_code == 200
    
    # Clean holdings
    db = SessionLocal()
    try:
        from app.models.transaction import Transaction
        user = db.query(User).filter(User.email == "john@example.com").first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.commit()
    finally:
        db.close()
        
    yield headers

    # Teardown: Clean holdings & transactions
    db = SessionLocal()
    try:
        from app.models.transaction import Transaction
        user = db.query(User).filter(User.email == "john@example.com").first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.commit()
    finally:
        db.close()


def test_target_allocations_sum_to_100():
    for profile, targets in TARGET_ALLOCATIONS.items():
        total = sum(targets.values())
        assert abs(total - 100.0) < 0.001, f"{profile} targets sum to {total}, expected 100.0%"


def test_empty_portfolio(setup_user_and_clean_holdings):
    headers = setup_user_and_clean_holdings
    r = client.get("/api/v1/portfolio", headers=headers)
    assert r.status_code == 200
    assert r.json() == []
    
    r_adv = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r_adv.status_code == 200
    data = r_adv.json()
    assert data["total_portfolio_value"] == 0.0
    assert data["needs_rebalancing"] is False
    assert "No portfolio holdings available" in data["summary"]


def test_user_current_test_data_tcs_and_bond(setup_user_and_clean_holdings):
    headers = setup_user_and_clean_holdings
    # 1. TCS Stock
    r1 = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 400.0,
        "average_buy_price": 4590.0
    })
    assert r1.status_code == 201
    
    # 2. Government Bond
    r2 = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "",
        "asset_name": "Government Bond",
        "asset_type": "Bond",
        "quantity": 150.0,
        "average_buy_price": 1000.0
    })
    assert r2.status_code == 201
    
    # Advisor check
    r_adv = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r_adv.status_code == 200
    data = r_adv.json()
    assert data["risk_profile"] == "moderate"
    assert data["portfolio_risk"] == "aggressive"
    assert data["needs_rebalancing"] is True
    
    # Verify recommendations identify Stock over target (40%) and ETF / Bond / Cash under target
    recs = data["recommendations"]
    assert any(r["asset_type"] == "Stock" and r["action"] == "reduce" for r in recs)
    assert any(r["asset_type"] == "ETF" and r["action"] == "increase" for r in recs)


def test_unit_scenario_a_100_percent_stock():
    # 100% Stock, Moderate profile
    allocs = {"Stock": 100.0}
    risk = _portfolio_risk_level(allocs)
    assert risk == "aggressive"
    recs = _generate_recommendations("moderate", allocs, TARGET_ALLOCATIONS["moderate"])
    assert any(r["asset_type"] == "Stock" and r["deviation"] == 60.0 and r["action"] == "reduce" for r in recs)


def test_unit_scenario_b_balanced():
    # 40% Stock, 25% ETF, 25% Bond, 10% Cash
    allocs = {"Stock": 40.0, "ETF": 25.0, "Bond": 25.0, "Cash": 10.0}
    risk = _portfolio_risk_level(allocs)
    assert risk == "moderate"
    recs = _generate_recommendations("moderate", allocs, TARGET_ALLOCATIONS["moderate"])
    assert len(recs) == 0  # 0 deviation -> Well Balanced!


def test_unit_scenario_c_conservative():
    # 20% Stock, 20% ETF, 50% Bond, 10% Cash
    allocs = {"Stock": 20.0, "ETF": 20.0, "Bond": 50.0, "Cash": 10.0}
    risk = _portfolio_risk_level(allocs)
    assert risk == "conservative"
    recs = _generate_recommendations("moderate", allocs, TARGET_ALLOCATIONS["moderate"])
    assert any(r["asset_type"] == "Stock" and r["action"] == "increase" for r in recs)
    assert any(r["asset_type"] == "Bond" and r["action"] == "reduce" for r in recs)


def test_unit_scenario_d_92_45_stock_7_55_bond():
    # 92.45% Stock, 7.55% Bond
    allocs = {"Stock": 92.45, "Bond": 7.55}
    risk = _portfolio_risk_level(allocs)
    assert risk == "aggressive"
    recs = _generate_recommendations("moderate", allocs, TARGET_ALLOCATIONS["moderate"])
    stock_rec = [r for r in recs if r["asset_type"] == "Stock"][0]
    assert stock_rec["action"] == "reduce"
    assert abs(stock_rec["deviation"] - 52.45) < 0.1


def test_invalid_ticker_rejection(setup_user_and_clean_holdings):
    headers = setup_user_and_clean_holdings
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS.NA",
        "asset_name": "Invalid Ticker",
        "asset_type": "Stock",
        "quantity": 10.0,
        "average_buy_price": 1000.0
    })
    assert r.status_code == 400
    assert "Invalid market ticker symbol" in r.json()["detail"]
