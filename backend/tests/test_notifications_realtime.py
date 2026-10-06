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

client = TestClient(app, raise_server_exceptions=False)


def create_test_user(prefix: str = "notif_user", risk_profile: str = "moderate", kyc_status: str = "pending"):
    email = f"{prefix}_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "Notification Tester",
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
    from app.services.notifications import NotificationService
    NotificationService.evaluate_user_alerts(db, u)
    user_id = u.id
    db.close()

    return {"headers": headers, "user_id": user_id, "email": email, "token": token}


def cleanup_user(user_info):
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


def test_1_ai_portfolio_alert_when_100_percent_stock():
    """
    TEST 1: Current portfolio = 100% Stock, User Risk = Moderate
    Expected: ONE canonical AI Rebalancing notification exists, 0 duplicate AI Portfolio Alerts.
    """
    u = create_test_user("test1_ai_alert", risk_profile="moderate", kyc_status="verified")
    try:
        # Add 100% stock holding (e.g., RELIANCE.NS)
        r = client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "RELIANCE.NS",
            "asset_name": "Reliance Industries",
            "asset_type": "Stock",
            "quantity": 10,
            "average_buy_price": 2500.0,
            "manual_price": 2500.0
        })
        assert r.status_code == 201

        # Fetch notifications
        notifs_res = client.get("/api/v1/notifications", headers=u["headers"])
        assert notifs_res.status_code == 200
        notifs = notifs_res.json()

        rebalance_alerts = [n for n in notifs if n["unique_key"] == "portfolio:rebalance"]
        assert len(rebalance_alerts) == 1, "Exactly ONE canonical AI Rebalancing alert must exist"
        rebalance_alert = rebalance_alerts[0]
        assert "Moderate" in rebalance_alert["message"]
        assert "Stock" in rebalance_alert["message"]
        assert "40" in rebalance_alert["message"]
        assert "100" in rebalance_alert["message"]
        assert "Debt/Fixed Income" in rebalance_alert["message"]

        # Verify no duplicate old "AI Portfolio Alert" exists
        old_ai_alerts = [n for n in notifs if n["title"] == "AI Portfolio Alert" or n["unique_key"] == "portfolio-moderate-equity-alert"]
        assert len(old_ai_alerts) == 0, "Duplicate AI Portfolio Alert must not exist"
    finally:
        cleanup_user(u)


def test_2_rebalancing_alert_resolved_when_portfolio_balanced():
    """
    TEST 2: Change portfolio allocation closer to target / remove deviation.
    Expected: Rebalancing alert should be resolved/deactivated.
    """
    u = create_test_user("test2_balanced", risk_profile="moderate", kyc_status="verified")
    try:
        # Step 1: Add initial 100% stock -> rebalance alert generated
        r1 = client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "TCS.NS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "quantity": 4,
            "average_buy_price": 1000.0,
            "manual_price": 1000.0
        })
        assert r1.status_code == 201
        holding_id = r1.json()["id"]

        notifs1 = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert any(n["unique_key"] == "portfolio:rebalance" for n in notifs1)

        # Step 2: Delete the unbalancing holding so portfolio is cleared/rebalanced
        del_res = client.delete(f"/api/v1/portfolio/{holding_id}", headers=u["headers"])
        assert del_res.status_code == 204

        notifs2 = client.get("/api/v1/notifications", headers=u["headers"]).json()
        rebalance_alert = next((n for n in notifs2 if n["unique_key"] == "portfolio:rebalance"), None)
        assert rebalance_alert is None, "AI Rebalancing Alert should be resolved when deviation is removed"
    finally:
        cleanup_user(u)


def test_3_add_large_stock_holding_triggers_alert_immediately():
    """
    TEST 3: Add a large Stock holding.
    Expected: Portfolio allocation changes, AI alert is generated immediately with dynamic percentage.
    """
    u = create_test_user("test3_large_stock", risk_profile="moderate", kyc_status="verified")
    try:
        # Add initial bond position
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "GOI718",
            "asset_name": "Bond",
            "asset_type": "Bond",
            "quantity": 100,
            "average_buy_price": 100.0,
            "manual_price": 100.0
        })

        # Now add massive stock holding
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "INFY.NS",
            "asset_name": "Infosys Ltd",
            "asset_type": "Stock",
            "quantity": 100,
            "average_buy_price": 1500.0,
            "manual_price": 1500.0
        })

        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        rebalance_alert = next((n for n in notifs if n["unique_key"] == "portfolio:rebalance"), None)
        assert rebalance_alert is not None
        assert "Moderate" in rebalance_alert["message"]
        assert "Stock" in rebalance_alert["message"]
    finally:
        cleanup_user(u)


def test_4_goal_progress_49_to_50_generates_milestone():
    """
    TEST 4: Goal progress: 49% -> 50%
    Expected: 50% milestone notification appears immediately.
    """
    u = create_test_user("test4_goal_50", risk_profile="moderate", kyc_status="verified")
    try:
        # Create goal at 49% (target 100000, current 49000)
        r = client.post("/api/v1/goals", headers=u["headers"], json={
            "title": "Dream Car",
            "category": "Vehicle",
            "target_amount": 100000.0,
            "current_amount": 49000.0,
            "monthly_contribution": 5000.0,
            "target_date": "2030-12-31"
        })
        assert r.status_code == 201
        goal_id = r.json()["id"]

        notifs_before = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert not any(n["unique_key"] == f"goal:{goal_id}:milestone:50" for n in notifs_before)

        # Update goal to 50% (50000)
        r_up = client.patch(f"/api/v1/goals/{goal_id}", headers=u["headers"], json={
            "current_amount": 50000.0
        })
        assert r_up.status_code == 200

        notifs_after = client.get("/api/v1/notifications", headers=u["headers"]).json()
        m50 = next((n for n in notifs_after if n["unique_key"] == f"goal:{goal_id}:milestone:50"), None)
        assert m50 is not None, "50% Milestone notification must be generated when progress reaches 50%"
        assert "50%" in m50["message"]
    finally:
        cleanup_user(u)


def test_5_goal_progress_50_to_51_no_duplicate():
    """
    TEST 5: 50% -> 51%
    Expected: NO duplicate 50% notification.
    """
    u = create_test_user("test5_no_dup_50", risk_profile="moderate", kyc_status="verified")
    try:
        r = client.post("/api/v1/goals", headers=u["headers"], json={
            "title": "Dream Vacation",
            "category": "Travel",
            "target_amount": 100000.0,
            "current_amount": 50000.0,
            "monthly_contribution": 5000.0,
            "target_date": "2030-12-31"
        })
        goal_id = r.json()["id"]

        # First verify 50% notification exists
        notifs_50 = client.get("/api/v1/notifications", headers=u["headers"]).json()
        count_50 = sum(1 for n in notifs_50 if n["unique_key"] == f"goal:{goal_id}:milestone:50")
        assert count_50 == 1

        # Advance to 51%
        client.patch(f"/api/v1/goals/{goal_id}", headers=u["headers"], json={
            "current_amount": 51000.0
        })

        notifs_51 = client.get("/api/v1/notifications", headers=u["headers"]).json()
        count_51 = sum(1 for n in notifs_51 if n["unique_key"] == f"goal:{goal_id}:milestone:50")
        assert count_51 == 1, "There must NOT be duplicate 50% milestone records"
    finally:
        cleanup_user(u)


def test_6_goal_progress_75_milestone():
    """
    TEST 6: 75% milestone crossed.
    Expected: 75% notification appears.
    """
    u = create_test_user("test6_goal_75", risk_profile="moderate", kyc_status="verified")
    try:
        r = client.post("/api/v1/goals", headers=u["headers"], json={
            "title": "House Renovation",
            "category": "Home",
            "target_amount": 200000.0,
            "current_amount": 150000.0,
            "monthly_contribution": 10000.0,
            "target_date": "2029-12-31"
        })
        goal_id = r.json()["id"]

        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        m75 = next((n for n in notifs if n["unique_key"] == f"goal:{goal_id}:milestone:75"), None)
        assert m75 is not None, "75% milestone alert should appear when goal reaches 75%"
        assert "75%" in m75["message"]
    finally:
        cleanup_user(u)


def test_7_goal_progress_100_milestone():
    """
    TEST 7: 100% milestone crossed.
    Expected: Goal Completed notification appears.
    """
    u = create_test_user("test7_goal_100", risk_profile="moderate", kyc_status="verified")
    try:
        r = client.post("/api/v1/goals", headers=u["headers"], json={
            "title": "Emergency Fund",
            "category": "Emergency",
            "target_amount": 50000.0,
            "current_amount": 50000.0,
            "monthly_contribution": 5000.0,
            "target_date": "2028-12-31"
        })
        goal_id = r.json()["id"]

        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        m100 = next((n for n in notifs if n["unique_key"] == f"goal:{goal_id}:milestone:100"), None)
        assert m100 is not None, "100% Goal Completed alert must appear"
        assert "Completed" in m100["title"] or "Completed" in m100["message"]
    finally:
        cleanup_user(u)


def test_8_refresh_dashboard_10_times_no_duplicates():
    """
    TEST 8: Refresh Dashboard / fetch notifications 10 times.
    Expected: NO duplicate notifications.
    """
    u = create_test_user("test8_no_dups", risk_profile="moderate", kyc_status="pending")
    try:
        # Create a goal and portfolio holding
        client.post("/api/v1/goals", headers=u["headers"], json={
            "title": "Retirement Corpus",
            "category": "Retirement",
            "target_amount": 1000000.0,
            "current_amount": 500000.0,
            "monthly_contribution": 20000.0,
            "target_date": "2045-12-31"
        })
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "HDFCBANK.NS",
            "asset_name": "HDFC Bank",
            "asset_type": "Stock",
            "quantity": 10,
            "average_buy_price": 1600.0,
            "manual_price": 1600.0
        })

        # Fetch notifications 10 times sequentially
        initial_count = None
        for _ in range(10):
            res = client.get("/api/v1/notifications", headers=u["headers"])
            assert res.status_code == 200
            items = res.json()
            if initial_count is None:
                initial_count = len(items)
            else:
                assert len(items) == initial_count, f"Duplicate notification rows created! Expected {initial_count}, got {len(items)}"

            # Verify all keys are unique
            keys = [n["unique_key"] for n in items]
            assert len(keys) == len(set(keys)), "Found duplicate unique_keys in notification response!"
    finally:
        cleanup_user(u)


def test_9_mark_notification_as_read_updates_unread_count():
    """
    TEST 9: Mark notification as read.
    Expected: Unread count decreases immediately.
    """
    u = create_test_user("test9_mark_read", risk_profile="moderate", kyc_status="pending")
    try:
        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert len(notifs) > 0
        first_notif = notifs[0]
        notif_id = first_notif["id"]

        unread_before = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]
        assert unread_before > 0

        # Mark first notification as read
        patch_res = client.patch(f"/api/v1/notifications/{notif_id}/read", headers=u["headers"])
        assert patch_res.status_code == 200
        assert patch_res.json()["is_read"] is True

        unread_after = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]
        assert unread_after == unread_before - 1
    finally:
        cleanup_user(u)


def test_10_user_isolation_security():
    """
    TEST 10: Create notification for User A.
    Expected: User B cannot see it.
    """
    u_a = create_test_user("test10_user_a", risk_profile="moderate", kyc_status="pending")
    u_b = create_test_user("test10_user_b", risk_profile="conservative", kyc_status="verified")
    try:
        notifs_a = client.get("/api/v1/notifications", headers=u_a["headers"]).json()
        notifs_b = client.get("/api/v1/notifications", headers=u_b["headers"]).json()

        user_a_ids = {n["user_id"] for n in notifs_a}
        user_b_ids = {n["user_id"] for n in notifs_b}

        assert all(uid == u_a["user_id"] for uid in user_a_ids)
        assert all(uid == u_b["user_id"] for uid in user_b_ids)
        assert u_a["user_id"] not in user_b_ids
    finally:
        cleanup_user(u_a)
        cleanup_user(u_b)


def test_11_kyc_status_change_pending_to_verified():
    """
    TEST 11: Change KYC: Pending -> Verified.
    Expected: Normal user gets 403 on direct KYC change, and KYC warning is resolved when verified.
    """
    u = create_test_user("test11_kyc_flow", risk_profile="moderate", kyc_status="pending")
    try:
        # Check KYC pending alert exists
        notifs_pending = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert any(n["unique_key"] == "kyc:pending" for n in notifs_pending)

        # Normal user cannot modify KYC directly -> returns 403 Forbidden
        r_kyc_unauth = client.patch("/api/v1/users/me/kyc-status", headers=u["headers"], json={
            "kyc_status": "verified"
        })
        assert r_kyc_unauth.status_code == 403

        # Update KYC status to verified via backend compliance/DB
        db = SessionLocal()
        try:
            db_user = db.query(User).filter(User.id == u["user_id"]).first()
            db_user.kyc_status = "verified"
            db.commit()
            from app.services.notifications import NotificationService
            NotificationService.evaluate_user_alerts(db, db_user)
        finally:
            db.close()

        # Fetch notifications again
        notifs_verified = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert not any(n["unique_key"] == "kyc:pending" for n in notifs_verified), "KYC warning should be cleared once verified"
    finally:
        cleanup_user(u)


def test_12_pnl_drawdown_alerts_and_no_price_spam():
    """
    TEST 12: Drawdown alert on severe loss (<= -10%) and dynamic resolution.
    Expected: Alert appears on significant loss without spamming duplicates and clears upon recovery.
    """
    u = create_test_user("test12_pnl_drawdown", risk_profile="moderate", kyc_status="verified")
    try:
        # Buy bond at ₹1000, manual price set to ₹850 (-15% loss)
        r_bond = client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "CORP-BOND-X",
            "asset_name": "Corporate Bond Series X",
            "asset_type": "Bond",
            "quantity": 10,
            "average_buy_price": 1000.0,
            "manual_price": 850.0
        })
        assert r_bond.status_code == 201
        bond_id = r_bond.json()["id"]

        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        drawdown_alert = next((n for n in notifs if n["unique_key"] == "portfolio:pnl_drawdown"), None)
        assert drawdown_alert is not None
        assert "down 15.0%" in drawdown_alert["message"] or "down" in drawdown_alert["message"]

        # Update manual price to ₹1050 (+5% profit)
        client.patch(f"/api/v1/portfolio/{bond_id}", headers=u["headers"], json={
            "manual_price": 1050.0
        })

        notifs_recovered = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert not any(n["unique_key"] == "portfolio:pnl_drawdown" for n in notifs_recovered)
    finally:
        cleanup_user(u)


def test_13_security_status_not_duplicated_on_dashboard_refresh_or_api_calls():
    """
    TEST 13: Security notification exists only for genuine security/session events.
    Refreshing dashboard / calling notification API 10 times does NOT create duplicate security notifications.
    """
    u = create_test_user("test13_sec_dup", risk_profile="moderate", kyc_status="verified")
    try:
        notifs_1 = client.get("/api/v1/notifications", headers=u["headers"]).json()
        sec_count_1 = sum(1 for n in notifs_1 if n.get("type") == "security" or "Security Status" in n.get("title", ""))

        for _ in range(10):
            res = client.get("/api/v1/notifications", headers=u["headers"]).json()
            sec_count = sum(1 for n in res if n.get("type") == "security" or "Security Status" in n.get("title", ""))
            assert sec_count == sec_count_1, f"Security notifications must NOT duplicate on refresh. Expected {sec_count_1}, got {sec_count}"
    finally:
        cleanup_user(u)


def test_14_get_endpoints_never_create_notifications():
    """
    TEST 14: Ensure that calling GET endpoints does NOT create any new notification rows.
    """
    u = create_test_user("test14_get_safe", risk_profile="moderate", kyc_status="verified")
    try:
        db = SessionLocal()
        initial_db_count = db.query(Notification).filter(Notification.user_id == u["user_id"]).count()
        db.close()

        # Call all GET endpoints multiple times
        for _ in range(5):
            client.get("/api/v1/notifications", headers=u["headers"])
            client.get("/api/v1/notifications/unread-count", headers=u["headers"])
            client.get("/api/v1/portfolio", headers=u["headers"])
            client.get("/api/v1/goals", headers=u["headers"])
            client.get("/api/v1/advisor/rebalancing", headers=u["headers"])
            client.get("/api/v1/users/me", headers=u["headers"])

        db = SessionLocal()
        final_db_count = db.query(Notification).filter(Notification.user_id == u["user_id"]).count()
        db.close()

        assert final_db_count == initial_db_count, f"GET requests created notifications! Before: {initial_db_count}, After: {final_db_count}"
    finally:
        cleanup_user(u)


def test_15_mark_all_read_and_read_persistence():
    """
    TEST 15: Verify Mark All Read, persistence across re-fetches, and notification deletion.
    """
    u = create_test_user("test15_mark_all", risk_profile="moderate", kyc_status="pending")
    try:
        # Create a 100% stock holding to have multiple unread alerts
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "TCS.NS",
            "asset_name": "Tata Consultancy Services",
            "asset_type": "Stock",
            "quantity": 10,
            "average_buy_price": 3000.0,
            "manual_price": 3000.0
        })

        notifs_before = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert len(notifs_before) >= 2
        unread_before = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]
        assert unread_before >= 2

        # Mark all as read
        r_all = client.patch("/api/v1/notifications/read-all", headers=u["headers"])
        assert r_all.status_code == 200

        unread_after = client.get("/api/v1/notifications/unread-count", headers=u["headers"]).json()["unread_count"]
        assert unread_after == 0

        # Refetch notifications: read status must persist
        notifs_after = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert all(n["is_read"] is True for n in notifs_after)

        # Delete one notification
        to_del_id = notifs_after[0]["id"]
        del_res = client.delete(f"/api/v1/notifications/{to_del_id}", headers=u["headers"])
        assert del_res.status_code == 200

        notifs_del = client.get("/api/v1/notifications", headers=u["headers"]).json()
        assert not any(n["id"] == to_del_id for n in notifs_del)
    finally:
        cleanup_user(u)


def test_16_canonical_ai_rebalancing_message():
    """
    TEST 16: Current scenario check:
    Risk Profile = MODERATE, Stock = 100%, Target = 40%
    Expected: Exactly ONE AI Rebalancing notification with dynamic message.
    """
    u = create_test_user("test16_ai_rec", risk_profile="moderate", kyc_status="verified")
    try:
        client.post("/api/v1/portfolio", headers=u["headers"], json={
            "symbol": "INFY.NS",
            "asset_name": "Infosys Ltd",
            "asset_type": "Stock",
            "quantity": 10,
            "average_buy_price": 1500.0,
            "manual_price": 1500.0
        })

        notifs = client.get("/api/v1/notifications", headers=u["headers"]).json()
        ai_notifs = [n for n in notifs if n["unique_key"] == "portfolio:rebalance"]
        assert len(ai_notifs) == 1, "Must have exactly ONE AI Rebalancing Recommended alert"

        msg = ai_notifs[0]["message"]
        assert "Moderate" in msg
        assert "100.0%" in msg
        assert "Stock" in msg
        assert "40.0%" in msg
        assert "Debt/Fixed Income" in msg

        # Ensure no overlapping old alerts
        old_alerts = [n for n in notifs if n["unique_key"] == "portfolio-moderate-equity-alert" or n["title"] == "AI Portfolio Alert"]
        assert len(old_alerts) == 0
    finally:
        cleanup_user(u)


