import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.goal import Goal
from app.models.notification import Notification

client = TestClient(app, raise_server_exceptions=False)

@pytest.fixture
def test_user_session():
    # Login demo user or register
    login_res = client.post("/api/v1/auth/login", json={
        "email": "john@example.com",
        "password": "password123"
    })
    if login_res.status_code != 200:
        client.post("/api/v1/auth/register", json={
            "email": "john@example.com",
            "password": "password123",
            "name": "John Doe",
            "risk_profile": "moderate"
        })
        login_res = client.post("/api/v1/auth/login", json={
            "email": "john@example.com",
            "password": "password123"
        })

    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    user = db.query(User).filter(User.email == "john@example.com").first()

    # Clean prior test state
    db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
    db.query(Goal).filter(Goal.user_id == user.id).delete()
    db.query(Notification).filter(Notification.user_id == user.id).delete()

    # Add acceptance holdings: INFY (Stock, 3 @ 3000, curr 1035), TCS (ETF, 3 @ 2114.72, curr 2075)
    infy = Portfolio(
        user_id=user.id,
        symbol="INFY",
        asset_name="Infosys Limited",
        asset_type="Stock",
        quantity=3.0,
        average_buy_price=3000.0,
        manual_price=1035.0,
    )
    tcs = Portfolio(
        user_id=user.id,
        symbol="TCS",
        asset_name="Tata Consultancy Services",
        asset_type="ETF",
        quantity=3.0,
        average_buy_price=2114.72,
        manual_price=2075.0,
    )
    db.add(infy)
    db.add(tcs)

    # Add a sample notification
    notif = Notification(
        user_id=user.id,
        type="ai_alert",
        title="⚠️ AI Portfolio Rebalancing",
        message="Your Moderate-risk portfolio has 66.7% ETF allocation versus the recommended 25.0% target.",
        severity="warning",
        is_read=False,
        is_active=True,
        unique_key=f"test:{user.id}:ai_rebalance",
    )
    db.add(notif)
    db.commit()

    yield {"user": user, "headers": headers, "db": db}

    db.close()


def test_wealth_report_endpoint_full_snapshot(test_user_session):
    headers = test_user_session["headers"]
    db = test_user_session["db"]
    user = test_user_session["user"]

    # Initial state counts
    notif_count_before = db.query(Notification).filter(Notification.user_id == user.id).count()
    holdings_count_before = db.query(Portfolio).filter(Portfolio.user_id == user.id).count()
    goals_count_before = db.query(Goal).filter(Goal.user_id == user.id).count()

    # GET /report/wealth
    res = client.get("/api/v1/report/wealth", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # 1. User Info
    assert data["user"]["risk_profile"] == "Moderate"

    # 2. Portfolio Totals (Stock 3105 + ETF 6225 = 9330)
    assert data["total_current_value"] == 9330.0
    assert abs(data["total_invested"] - 15344.16) < 0.1
    assert abs(data["total_profit_loss"] - (-6014.16)) < 0.1

    # 3. Portfolio Holdings
    assert len(data["portfolio"]) == 2
    infy = next(h for h in data["portfolio"] if h["symbol"] == "INFY")
    tcs = next(h for h in data["portfolio"] if h["symbol"] == "TCS")
    assert infy["asset_type"] == "Stock"
    assert infy["current_value"] == 3105.0
    assert tcs["asset_type"] == "ETF"
    assert tcs["current_value"] == 6225.0

    # 4. AI Advisor Rebalancing
    assert "advisor" in data
    assert data["advisor"]["risk_profile"] == "moderate"
    assert data["advisor"]["needs_rebalancing"] is True

    alloc_summary = data["advisor"]["allocation_summary"]
    stock_alloc = next(a for a in alloc_summary if a["asset_type"] == "Stock")
    etf_alloc = next(a for a in alloc_summary if a["asset_type"] == "ETF")
    bond_alloc = next(a for a in alloc_summary if a["asset_type"] == "Bond")
    cash_alloc = next(a for a in alloc_summary if a["asset_type"] == "Cash")

    assert abs(stock_alloc["current_pct"] - 33.28) < 0.1
    assert stock_alloc["target_pct"] == 40.0
    assert stock_alloc["status"] == "UNDERWEIGHT"

    assert abs(etf_alloc["current_pct"] - 66.72) < 0.1
    assert etf_alloc["target_pct"] == 25.0
    assert etf_alloc["status"] == "OVERWEIGHT"

    assert bond_alloc["current_pct"] == 0.0
    assert bond_alloc["target_pct"] == 25.0
    assert bond_alloc["status"] == "UNDERWEIGHT"

    assert cash_alloc["current_pct"] == 0.0
    assert cash_alloc["target_pct"] == 10.0
    assert cash_alloc["status"] == "UNDERWEIGHT"

    # 5. Read-only verification: DB state unchanged after repeated calls
    for _ in range(3):
        r = client.get("/api/v1/report/wealth", headers=headers)
        assert r.status_code == 200

    assert db.query(Notification).filter(Notification.user_id == user.id).count() == notif_count_before
    assert db.query(Portfolio).filter(Portfolio.user_id == user.id).count() == holdings_count_before
    assert db.query(Goal).filter(Goal.user_id == user.id).count() == goals_count_before
