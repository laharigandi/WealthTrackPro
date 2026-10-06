import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_application_flow():
    # 1. Health
    r = client.get("/health")
    assert r.status_code == 200

    # 2. Password validation
    r = client.post("/api/v1/auth/register", json={
        "name": "Short Pass User",
        "email": "shortpass@example.com",
        "password": "short"
    })
    assert r.status_code == 400

    # 3. Registration & Login
    email = f"integration_test_{int(time.time()*1000)}@example.com"
    client.post("/api/v1/auth/register", json={
        "name": "Integration User",
        "email": email,
        "password": "Password123!"
    })
    
    r = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}


    # 4. User Profile
    r = client.get("/api/v1/users/me", headers=headers)
    assert r.status_code == 200

    # 5. Risk & KYC
    r = client.patch("/api/v1/users/me/risk-profile", headers=headers, json={"risk_profile": "aggressive"})
    assert r.status_code == 200
    # Normal user direct KYC patch must be rejected with 403 Forbidden
    r = client.patch("/api/v1/users/me/kyc-status", headers=headers, json={"kyc_status": "verified"})
    assert r.status_code == 403

    # 6. Goals & Simulation
    r = client.post("/api/v1/goals", headers=headers, json={
        "title": "Retirement Fund",
        "category": "Retirement",
        "target_amount": 10000000.0,
        "current_amount": 500000.0,
        "monthly_contribution": 30000.0,
        "target_date": "2040-12-31",
        "expected_return_rate": 12.0
    })
    assert r.status_code == 201
    goal_id = r.json()["id"]

    r = client.post(f"/api/v1/goals/{goal_id}/simulate", headers=headers, json={
        "monthly_contribution": 35000.0,
        "expected_return_rate": 12.0
    })
    assert r.status_code == 200

    # 7. Transactions & Portfolio Sync
    r = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "RELIANCE",
        "asset_name": "Reliance Industries Ltd",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 15.0,
        "price": 2980.0
    })
    assert r.status_code == 201

    r = client.get("/api/v1/portfolio", headers=headers)
    assert r.status_code == 200
    rel_holding = [i for i in r.json() if i["symbol"] in ("RELIANCE", "RELIANCE.NS") or i["normalized_symbol"] == "RELIANCE.NS"][0]
    assert rel_holding["quantity"] == 15.0

    # 8. Market Quotes
    r = client.get("/api/v1/market/RELIANCE")
    assert r.status_code == 200
