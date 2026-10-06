import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction

client = TestClient(app, raise_server_exceptions=False)

def test_buy_tcs_sell_tcs_ns_via_portfolio():
    email = f"tcs_norm_test_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "TCS Norm Tester",
        "email": email,
        "password": "Password123!"
    })
    assert r.status_code == 201

    token = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create holding via POST /portfolio with symbol "TCS"
    r_buy = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 2.0,
        "average_buy_price": 2332.0,
    })
    assert r_buy.status_code == 201
    
    port_before = client.get("/api/v1/portfolio", headers=headers).json()
    assert len(port_before) == 1
    assert port_before[0]["quantity"] == 2.0

    # 2. Record SELL with symbol "TCS.NS"
    r_sell = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2066.20,
    })
    assert r_sell.status_code == 201

    # 3. Verify portfolio holding
    port_after = client.get("/api/v1/portfolio", headers=headers).json()
    assert len(port_after) == 1
    assert port_after[0]["quantity"] == 1.0
    assert port_after[0]["average_buy_price"] == 2332.0

    # 4. Record SELL remaining 1
    r_sell2 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2066.20,
    })
    assert r_sell2.status_code == 201

    port_empty = client.get("/api/v1/portfolio", headers=headers).json()
    assert len(port_empty) == 0

def test_buy_tcs_raw_via_transactions():
    email = f"tcs_raw_tx_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "TCS Raw TX Tester",
        "email": email,
        "password": "Password123!"
    })
    assert r.status_code == 201

    token = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # BUY 2 with symbol "TCS"
    r_buy = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 2.0,
        "price": 2332.0,
    })
    assert r_buy.status_code == 201

    # SELL 1 with symbol "TCS.NS"
    r_sell = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "SELL",
        "quantity": 1.0,
        "price": 2066.20,
    })
    assert r_sell.status_code == 201

    port = client.get("/api/v1/portfolio", headers=headers).json()
    assert len(port) == 1
    assert port[0]["quantity"] == 1.0
    assert port[0]["average_buy_price"] == 2332.0
