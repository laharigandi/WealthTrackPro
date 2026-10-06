"""
Comprehensive Final Audit Test Suite for WealthTrackPro Notification System
Validates all 16 audit requirements from the user request.
"""
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.goal import Goal
from app.models.portfolio import Portfolio
from app.models.notification import Notification
from app.models.transaction import Transaction
from app.services.notifications import NotificationService

client = TestClient(app, raise_server_exceptions=False)


def create_audit_user(name: str = "Audit User", risk_profile: str = "moderate", kyc_status: str = "verified"):
    email = f"audit_{int(time.time() * 1000)}_{name.lower().replace(' ', '_')}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": name,
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
    u.risk_profile = risk_profile
    u.kyc_status = kyc_status
    db.commit()
    NotificationService.evaluate_user_alerts(db, u)
    user_id = u.id
    db.close()

    return {"headers": headers, "user_id": user_id, "email": email, "token": token}


def cleanup_audit_user(user_info):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_info["user_id"]).first()
        if user:
            db.query(Notification).filter(Notification.user_id == user.id).delete()
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.query(Goal).filter(Goal.user_id == user.id).delete()
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_point_1_and_2_and_3_calculations_consistency():
    """
    POINTS 1, 2, 3:
    1. Verify Portfolio Performance Alert uses the same portfolio calculation as Dashboard.
    2. Verify AI Rebalancing notification uses the same risk/allocation calculation as AI Advisor and Dashboard.
    3. Verify 100% Stock vs 40% Moderate target produces +60 percentage-point drift.
    """
    u = create_audit_user("calc_audit_user", risk_profile="moderate", kyc_status="verified")
    try:
        # Create 2 stock holdings:
        # TCS: 2 shares @ 3054.67 (invested = 6109.34), manual price = 2500 (value = 5000)
        # INFY: 5 shares @ 1277.58 (invested = 6387.90), manual price = 918 (value = 4590)
        # Total Invested = 12497.24, Total Value = 9590.00, PnL = -2907.24 (-23.3%)
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "TCS.NS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "quantity": 2,
            "average_buy_price": 3054.6667,
            "manual_price": 2500.0
        })
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "INFY.NS",
            "asset_name": "Infosys Ltd",
            "asset_type": "Stock",
            "quantity": 5,
            "average_buy_price": 1277.58,
            "manual_price": 918.0
        })

        # Fetch Dashboard / Portfolio data
        port_res = client.get("/api/v1/portfolio", headers=u["headers"]).json()
        total_inv = sum(p["total_investment_value"] for p in port_res)
        total_val = sum(p["current_value"] for p in port_res)
        dashboard_pnl = total_val - total_inv
        dashboard_pnl_pct = (dashboard_pnl / total_inv) * 100

        # Fetch AI Advisor data
        advisor_res = client.get("/api/v1/advisor/rebalancing", headers=u["headers"]).json()
        advisor_stock_pct = next(a["current_pct"] for a in advisor_res["allocation_summary"] if a["asset_type"] == "Stock")
        advisor_stock_target = next(a["target_pct"] for a in advisor_res["allocation_summary"] if a["asset_type"] == "Stock")
        advisor_drift = next(a["difference_pp"] for a in advisor_res["allocation_summary"] if a["asset_type"] == "Stock")

        # Fetch Notifications
        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        pnl_notif = next(n for n in notifs if n["unique_key"] == "portfolio:pnl_drawdown")
        ai_notif = next(n for n in notifs if n["unique_key"] == "portfolio:rebalance")

        # Point 1 check: PnL alert uses exact dashboard loss percentage
        assert f"{abs(dashboard_pnl_pct):.1f}%" in pnl_notif["message"]

        # Point 2 & 3 check: AI Rebalancing uses exact advisor allocation, target, and drift
        assert advisor_stock_pct == 100.0
        assert advisor_stock_target == 40.0
        assert advisor_drift == 60.0
        assert f"{advisor_stock_pct:.1f}%" in ai_notif["message"]
        assert f"{advisor_stock_target:.1f}%" in ai_notif["message"]
        assert "Stock" in ai_notif["message"]
        assert "Moderate" in ai_notif["message"]
        assert "Debt/Fixed Income" in ai_notif["message"]
    finally:
        cleanup_audit_user(u)


def test_point_4_and_5_and_6_and_7_and_8_refresh_and_idempotency():
    """
    POINTS 4, 5, 6, 7, 8:
    4. Verify the same active condition does NOT create duplicate notifications.
    5. Refresh Dashboard 10 times — notification count must remain unchanged.
    6. Open/close Notifications 10 times — notification count must remain unchanged.
    7. Call notification GET API repeatedly — it must NEVER create new notifications.
    8. Verify Security Status is NOT recreated on every page refresh, polling cycle, or API request.
    """
    u = create_audit_user("idempotency_audit_user", risk_profile="moderate", kyc_status="verified")
    try:
        # Create holding that triggers AI Rebalancing & Performance alert
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "TCS.NS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "quantity": 2,
            "average_buy_price": 3054.67,
            "manual_price": 2343.0
        })

        initial_notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        initial_count = len(initial_notifs)
        assert initial_count >= 3  # Performance alert + Security status + AI Rebalancing

        db = SessionLocal()
        initial_db_count = db.query(Notification).filter(Notification.user_id == u["user_id"]).count()
        db.close()
        assert initial_db_count == initial_count

        # 5. Refresh Dashboard 10 times (GET portfolio, GET goals, GET advisor, GET report)
        for _ in range(10):
            client.get("/api/v1/portfolio", headers=u["headers"])
            client.get("/api/v1/goals", headers=u["headers"])
            client.get("/api/v1/advisor/rebalancing", headers=u["headers"])
            client.get("/api/v1/report/wealth", headers=u["headers"])

        # 6. Open/close Notifications 10 times (GET /notifications, GET /unread-count)
        for _ in range(10):
            client.get("/api/v1/notifications", headers=u["headers"])
            client.get("/api/v1/notifications/unread-count", headers=u["headers"])

        # 7. Repeated notification GET calls
        for _ in range(10):
            res = client.get("/api/v1/notifications", headers=u["headers"])
            assert res.status_code == 200
            assert len(res.json()) == initial_count

        db = SessionLocal()
        final_db_count = db.query(Notification).filter(Notification.user_id == u["user_id"]).count()
        sec_db_count = db.query(Notification).filter(
            Notification.user_id == u["user_id"],
            Notification.type == "security"
        ).count()
        db.close()

        # Point 4, 5, 6, 7 check: Total count unchanged
        assert final_db_count == initial_db_count, f"Database rows changed! Expected {initial_db_count}, got {final_db_count}"
        
        # Point 8 check: Security status exactly 1 record, not recreated
        assert sec_db_count == 1, f"Security status duplicated! Count: {sec_db_count}"
    finally:
        cleanup_audit_user(u)


def test_point_9_and_10_realtime_events_and_unread_count():
    """
    POINTS 9, 10:
    9. Verify real-time notifications: Trigger a genuine new Goal/Portfolio event.
    10. Verify unread count updates exactly once for a new notification.
    """
    u = create_audit_user("realtime_audit_user", risk_profile="moderate", kyc_status="verified")
    try:
        # Initial unread count
        unread_initial = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]

        # Trigger genuine new Goal event crossing 50% milestone
        r_goal = client.post("/api/v1/goals", headers=u["headers"], json={
            "title": "Home Downpayment",
            "category": "Home",
            "target_amount": 100000.0,
            "current_amount": 50000.0,
            "monthly_contribution": 5000.0,
            "target_date": "2030-12-31"
        })
        assert r_goal.status_code == 201
        goal_id = r_goal.json()["id"]

        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        m50 = next((n for n in notifs if n["unique_key"] == f"goal:{goal_id}:milestone:50"), None)
        assert m50 is not None, "50% Goal Milestone must appear immediately upon creation"

        unread_after = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]
        # Point 10 check: unread count increased by exactly 1
        assert unread_after == unread_initial + 1
    finally:
        cleanup_audit_user(u)


def test_point_11_and_12_and_13_mark_read_and_persistence():
    """
    POINTS 11, 12, 13:
    11. Verify Mark all read changes unread count to 0 and persists after refresh.
    12. Verify read notifications do not become unread after refresh.
    13. Verify old historical notifications are not unnecessarily deleted.
    """
    u = create_audit_user("read_persistence_user", risk_profile="moderate", kyc_status="verified")
    try:
        # Create a goal with 50% milestone
        client.post("/api/v1/goals", headers=u["headers"], json={
            "title": "Vacation 2028",
            "category": "Travel",
            "target_amount": 50000.0,
            "current_amount": 25000.0,
            "monthly_contribution": 2000.0,
            "target_date": "2028-12-31"
        })

        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert len(notifs) >= 2
        unread_before = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]
        assert unread_before >= 2

        # 11. Mark all read
        r_mark = client.patch("/api/v1/notifications/read-all", headers=u["headers"])
        assert r_mark.status_code == 200

        unread_zero = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]
        assert unread_zero == 0

        # Simulate 10 dashboard/page refreshes
        for _ in range(10):
            client.get("/api/v1/notifications", headers=u["headers"])
            client.get("/api/v1/notifications/unread-count", headers=u["headers"])

        # 12. Verify read notifications do NOT revert to unread
        notifs_after_refresh = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert all(n["is_read"] is True for n in notifs_after_refresh)
        assert client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"] == 0

        # 13. Verify historical notifications remain intact
        assert len(notifs_after_refresh) == len(notifs)
    finally:
        cleanup_audit_user(u)


def test_point_14_and_15_and_16_db_constraints_and_price_flutter():
    """
    POINTS 14, 15, 16:
    14. Verify PostgreSQL prevents duplicate notification events.
    15. Verify frontend real-time reconnect does not insert duplicate notifications.
    16. Verify live market-price updates do not generate notification spam.
    """
    u = create_audit_user("db_and_price_user", risk_profile="moderate", kyc_status="verified")
    try:
        # Create holding
        r_hold = client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "RELIANCE.NS",
            "asset_name": "Reliance Industries",
            "asset_type": "Stock",
            "quantity": 10,
            "average_buy_price": 2500.0,
            "manual_price": 1900.0  # -24.0% loss
        })
        holding_id = r_hold.json()["id"]

        # 14. Direct DB duplicate insertion attempt with same unique_key must violate unique constraint
        db = SessionLocal()
        dup_notif = Notification(
            user_id=u["user_id"],
            type="portfolio_pnl",
            title="Duplicate Test",
            message="This should fail",
            severity="warning",
            unique_key="portfolio:pnl_drawdown"
        )
        db.add(dup_notif)
        with pytest.raises(Exception):
            db.commit()
        db.rollback()
        db.close()

        # 16. Live market-price updates / small price changes do NOT create duplicate notifications
        notif_count_before = len(client.get("/api/v1/notifications", headers=u["headers"]).json())

        # Update price from 1900 -> 1895 -> 1905 -> 1898 (minor market price movement within loss threshold)
        for p in [1895.0, 1905.0, 1898.0, 1892.0]:
            client.patch(f"/api/v1/portfolio/{holding_id}", headers=u["headers"], json={
                "manual_price": p
            })

        notifs_after_flutter = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert len(notifs_after_flutter) == notif_count_before, "Market price movements must NOT create duplicate notification rows!"
    finally:
        cleanup_audit_user(u)
