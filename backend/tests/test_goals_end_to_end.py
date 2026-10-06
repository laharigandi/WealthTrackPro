import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.goal import Goal

client = TestClient(app, raise_server_exceptions=False)


def create_test_user(prefix: str = "goal_test_user"):
    email = f"{prefix}_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "Goal Tester",
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


def cleanup_user(user_info):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_info["user_id"]).first()
        if user:
            db.query(Goal).filter(Goal.user_id == user.id).delete()
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_valid_goal_creation_and_db_persistence():
    """
    Test Case A: Valid goal creation
    - Goal: Dream Car
    - Target Amount: ₹12,00,000
    - Current Saved: ₹5,50,000
    - Monthly Investment: ₹20,000
    - Valid target date
    Expected: Goal should be successfully created and stored in PostgreSQL.
    """
    u = create_test_user("valid_goal")
    headers = u["headers"]
    try:
        payload = {
            "title": "Dream Car",
            "category": "Car",
            "target_amount": 1200000.0,
            "current_amount": 550000.0,
            "monthly_contribution": 20000.0,
            "target_date": "2030-12-31",
            "expected_return_rate": 10.0
        }
        res = client.post("/api/v1/goals", headers=headers, json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "Dream Car"
        assert data["category"] == "Car"
        assert data["target_amount"] == 1200000.0
        assert data["current_amount"] == 550000.0
        assert data["monthly_contribution"] == 20000.0
        assert data["target_date"] == "2030-12-31"
        assert data["remaining_amount"] == 650000.0
        assert data["progress_percentage"] == round((550000.0 / 1200000.0) * 100, 2)
        goal_id = data["id"]

        # Verify record exists in PostgreSQL database directly
        db = SessionLocal()
        db_goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == u["user_id"]).first()
        assert db_goal is not None
        assert db_goal.title == "Dream Car"
        assert db_goal.target_amount == 1200000.0
        assert db_goal.current_amount == 550000.0
        assert db_goal.monthly_contribution == 20000.0
        db.close()

        # Verify GET /api/v1/goals returns this goal
        list_res = client.get("/api/v1/goals", headers=headers)
        assert list_res.status_code == 200
        goals_list = list_res.json()
        assert any(g["id"] == goal_id for g in goals_list)
    finally:
        cleanup_user(u)


def test_field_aliases_support():
    """
    Test Case: API Contract field aliases
    Request payload with goal_name, goal_type, current_saved, monthly_investment
    """
    u = create_test_user("alias_goal")
    headers = u["headers"]
    try:
        payload = {
            "goal_name": "Luxury Apartment",
            "goal_type": "Buying a House",
            "target_amount": 8500000.0,
            "current_saved": 1500000.0,
            "monthly_investment": 50000.0,
            "target_date": "2035-06-30"
        }
        res = client.post("/api/v1/goals", headers=headers, json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "Luxury Apartment"
        assert data["category"] == "Buying a House"
        assert data["target_amount"] == 8500000.0
        assert data["current_amount"] == 1500000.0
        assert data["monthly_contribution"] == 50000.0
    finally:
        cleanup_user(u)


def test_empty_required_fields_rejected():
    """
    Test Case B: Empty required fields
    Expected: Readable validation error (422).
    """
    u = create_test_user("empty_fields")
    headers = u["headers"]
    try:
        # Empty title
        res1 = client.post("/api/v1/goals", headers=headers, json={
            "title": "   ",
            "target_amount": 100000.0,
            "target_date": "2030-12-31"
        })
        assert res1.status_code == 422

        # Empty target_amount
        res2 = client.post("/api/v1/goals", headers=headers, json={
            "title": "Vacation Fund",
            "target_date": "2030-12-31"
        })
        assert res2.status_code == 422

        # Empty target_date
        res3 = client.post("/api/v1/goals", headers=headers, json={
            "title": "Vacation Fund",
            "target_amount": 100000.0,
            "target_date": ""
        })
        assert res3.status_code == 422
    finally:
        cleanup_user(u)


def test_target_amount_zero_and_negative_rejected():
    """
    Test Cases C & D:
    Target amount = 0 and negative target amount rejected.
    """
    u = create_test_user("target_amt_val")
    headers = u["headers"]
    try:
        # Target amount = 0
        res0 = client.post("/api/v1/goals", headers=headers, json={
            "title": "Zero Target Goal",
            "target_amount": 0.0,
            "target_date": "2030-12-31"
        })
        assert res0.status_code == 422

        # Target amount negative
        res_neg = client.post("/api/v1/goals", headers=headers, json={
            "title": "Negative Target Goal",
            "target_amount": -50000.0,
            "target_date": "2030-12-31"
        })
        assert res_neg.status_code == 422
    finally:
        cleanup_user(u)


def test_current_saved_greater_than_target_amount():
    """
    Test Case E: Current saved > target amount
    Expected: Handled properly without invalid state; progress capped at 100%, remaining at 0.
    """
    u = create_test_user("saved_exceeds")
    headers = u["headers"]
    try:
        payload = {
            "title": "Achieved Milestone",
            "category": "Emergency Fund",
            "target_amount": 200000.0,
            "current_amount": 300000.0,
            "monthly_contribution": 5000.0,
            "target_date": "2029-12-31"
        }
        res = client.post("/api/v1/goals", headers=headers, json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["remaining_amount"] == 0.0
        assert data["progress_percentage"] == 100.0
    finally:
        cleanup_user(u)


def test_invalid_target_date_rejected():
    """
    Test Case F: Invalid date
    Expected: Readable validation error for past date or malformed date.
    """
    u = create_test_user("date_val")
    headers = u["headers"]
    try:
        # Past date
        res_past = client.post("/api/v1/goals", headers=headers, json={
            "title": "Past Goal",
            "target_amount": 500000.0,
            "target_date": "2020-01-01"
        })
        assert res_past.status_code == 422

        # Malformed date
        res_mal = client.post("/api/v1/goals", headers=headers, json={
            "title": "Malformed Date Goal",
            "target_amount": 500000.0,
            "target_date": "not-a-date"
        })
        assert res_mal.status_code == 422
    finally:
        cleanup_user(u)


def test_duplicate_goal_rejected():
    """
    Test Case G: Duplicate goal
    Expected: Reject duplicate goal title for the same user with clear error.
    """
    u = create_test_user("dup_goal")
    headers = u["headers"]
    try:
        payload1 = {
            "title": "Unique Dream Car",
            "category": "Car",
            "target_amount": 1000000.0,
            "current_amount": 100000.0,
            "monthly_contribution": 15000.0,
            "target_date": "2030-12-31"
        }
        res1 = client.post("/api/v1/goals", headers=headers, json=payload1)
        assert res1.status_code == 201

        # Attempt duplicate creation
        payload2 = {
            "title": "unique dream car",  # case-insensitive match
            "category": "Car",
            "target_amount": 1200000.0,
            "target_date": "2031-12-31"
        }
        res2 = client.post("/api/v1/goals", headers=headers, json=payload2)
        assert res2.status_code == 400
        assert "already exists" in res2.json()["detail"].lower()
    finally:
        cleanup_user(u)
