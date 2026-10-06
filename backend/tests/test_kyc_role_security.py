import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, KYCStatusEnum, RiskProfileEnum
from app.services.notifications import NotificationService

client = TestClient(app, raise_server_exceptions=False)


def create_user_with_kyc(prefix: str, kyc_status: str, risk_profile: str = "moderate"):
    unique_email = f"{prefix}_{int(time.time() * 1000)}@example.com"
    reg_res = client.post("/api/v1/auth/register", json={
        "name": f"Test User {prefix}",
        "email": unique_email,
        "password": "Password123!"
    })
    assert reg_res.status_code == 201

    login_res = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == unique_email).first()
        user.kyc_status = kyc_status
        user.risk_profile = risk_profile
        db.commit()
        NotificationService.evaluate_user_alerts(db, user)
        user_id = user.id
    finally:
        db.close()

    return {"headers": headers, "email": unique_email, "user_id": user_id, "token": token}


def test_normal_user_profile_kyc_read_only():
    """
    Case A: Normal user gets profile with KYC status, but cannot modify KYC status via API.
    Must receive HTTP 403 Forbidden.
    """
    user_data = create_user_with_kyc("norm_user", "pending")
    headers = user_data["headers"]

    # 1. Fetch profile
    profile_res = client.get("/api/v1/users/me", headers=headers)
    assert profile_res.status_code == 200
    data = profile_res.json()
    assert data["kyc_status"] == "pending"

    # 2. Attempt direct KYC modification to verified -> Rejected with 403 Forbidden
    patch_res = client.patch("/api/v1/users/me/kyc-status", headers=headers, json={"kyc_status": "verified"})
    assert patch_res.status_code == 403
    assert "Forbidden" in patch_res.json()["detail"] or "Standard users cannot modify" in patch_res.json()["detail"]

    # 3. Verify user KYC status is still unchanged in DB
    profile_check = client.get("/api/v1/users/me", headers=headers)
    assert profile_check.json()["kyc_status"] == "pending"


def test_verified_user_kyc_immutable():
    """
    Case B: Verified user: Status displays VERIFIED and user cannot alter it.
    """
    user_data = create_user_with_kyc("verif_user", "verified")
    headers = user_data["headers"]

    # Status displays VERIFIED
    res = client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["kyc_status"] == "verified"

    # Attempt to change to rejected -> 403
    patch_res = client.patch("/api/v1/users/me/kyc-status", headers=headers, json={"kyc_status": "rejected"})
    assert patch_res.status_code == 403

    # Attempt to change to pending -> 403
    patch_res2 = client.patch("/api/v1/users/me/kyc-status", headers=headers, json={"kyc_status": "pending"})
    assert patch_res2.status_code == 403


def test_pending_user_kyc_immutable():
    """
    Case C: Pending user: Status displays PENDING, KYC pending alert exists, user cannot self-verify.
    """
    user_data = create_user_with_kyc("pend_user", "pending")
    headers = user_data["headers"]

    # Status displays PENDING
    res = client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["kyc_status"] == "pending"

    # Pending KYC notification alert is active
    notifs = client.get("/api/v1/notifications", headers=headers).json()
    assert any(n["unique_key"] == "kyc:pending" for n in notifs)

    # Attempt to self-verify -> 403
    patch_res = client.patch("/api/v1/users/me/kyc-status", headers=headers, json={"kyc_status": "verified"})
    assert patch_res.status_code == 403


def test_rejected_user_kyc_immutable():
    """
    Case D: Rejected user: Status displays REJECTED and user cannot change it.
    """
    user_data = create_user_with_kyc("rej_user", "rejected")
    headers = user_data["headers"]

    # Status displays REJECTED
    res = client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["kyc_status"] == "rejected"

    # Attempt to change to verified -> 403
    patch_res = client.patch("/api/v1/users/me/kyc-status", headers=headers, json={"kyc_status": "verified"})
    assert patch_res.status_code == 403


def test_risk_profile_still_modifiable_by_user():
    """
    Ensures risk profiling remains fully functional for users while KYC is restricted.
    """
    user_data = create_user_with_kyc("risk_user", "verified", risk_profile="moderate")
    headers = user_data["headers"]

    # Risk profile can be changed by user
    patch_risk = client.patch("/api/v1/users/me/risk-profile", headers=headers, json={"risk_profile": "aggressive"})
    assert patch_risk.status_code == 200
    assert patch_risk.json()["risk_profile"] == "aggressive"


def test_unauthenticated_kyc_patch_returns_401():
    """
    Unauthenticated attempts to modify KYC return 401 Unauthorized.
    """
    res = client.patch("/api/v1/users/me/kyc-status", json={"kyc_status": "verified"})
    assert res.status_code == 401
