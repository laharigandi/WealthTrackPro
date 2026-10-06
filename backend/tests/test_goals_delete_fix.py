import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models.user import User
from app.models.goal import Goal
from app.models.notification import Notification
import time

client = TestClient(app)

def create_authenticated_user(email_prefix="goal_test"):
    unique_email = f"{email_prefix}_{int(time.time() * 1000)}@example.com"
    password = "Password123!"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"name": "Goal Tester", "email": unique_email, "password": password},
    )
    assert reg_res.status_code in [200, 201]
    
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    user_id = login_res.json()["user"]["id"]
    return {"token": token, "user_id": user_id, "email": unique_email, "headers": {"Authorization": f"Bearer {token}"}}

def test_goal_delete_normal_flow():
    # 1. Setup User
    user = create_authenticated_user("normal_delete")
    
    # 2. Create Goal "House"
    create_res = client.post(
        "/api/v1/goals",
        headers=user["headers"],
        json={
            "title": f"House_{int(time.time()*1000)}",
            "category": "Buying a House",
            "target_amount": 1000000.0,
            "current_amount": 300000.0,
            "monthly_contribution": 15000.0,
            "target_date": "2030-12-31",
            "expected_return_rate": 8.0,
        }
    )
    assert create_res.status_code in [200, 201]
    goal_id = create_res.json()["id"]

    # 3. Delete Goal
    del_res = client.delete(f"/api/v1/goals/{goal_id}", headers=user["headers"])
    assert del_res.status_code == 204

    # 4. Verify GET /goals does not return deleted goal
    list_res = client.get("/api/v1/goals", headers=user["headers"])
    assert list_res.status_code == 200
    goals = list_res.json()
    assert all(g["id"] != goal_id for g in goals)

def test_delete_one_goal_keeps_other_goals():
    user = create_authenticated_user("multi_delete")
    ts = int(time.time() * 1000)

    # Create Goal House
    r1 = client.post(
        "/api/v1/goals",
        headers=user["headers"],
        json={
            "title": f"House_{ts}",
            "category": "Buying a House",
            "target_amount": 1000000.0,
            "current_amount": 300000.0,
            "monthly_contribution": 10000.0,
            "target_date": "2031-12-31",
            "expected_return_rate": 8.0,
        }
    )
    assert r1.status_code in [200, 201]
    house_id = r1.json()["id"]

    # Create Goal Car
    r2 = client.post(
        "/api/v1/goals",
        headers=user["headers"],
        json={
            "title": f"Car_{ts}",
            "category": "Car",
            "target_amount": 500000.0,
            "current_amount": 100000.0,
            "monthly_contribution": 8000.0,
            "target_date": "2028-12-31",
            "expected_return_rate": 8.0,
        }
    )
    assert r2.status_code in [200, 201]
    car_id = r2.json()["id"]

    # Delete House
    del_res = client.delete(f"/api/v1/goals/{house_id}", headers=user["headers"])
    assert del_res.status_code == 204

    # Verify House is gone, Car remains
    list_res = client.get("/api/v1/goals", headers=user["headers"])
    assert list_res.status_code == 200
    remaining_ids = [g["id"] for g in list_res.json()]
    assert house_id not in remaining_ids
    assert car_id in remaining_ids

    # Delete Car
    del_car = client.delete(f"/api/v1/goals/{car_id}", headers=user["headers"])
    assert del_car.status_code == 204

    # Verify no goals remain
    list_res2 = client.get("/api/v1/goals", headers=user["headers"])
    assert list_res2.status_code == 200
    assert len(list_res2.json()) == 0

def test_delete_goal_authorization_security():
    user_a = create_authenticated_user("user_a")
    user_b = create_authenticated_user("user_b")

    # Create Goal A under User A
    r_a = client.post(
        "/api/v1/goals",
        headers=user_a["headers"],
        json={
            "title": f"GoalA_{int(time.time()*1000)}",
            "category": "Education",
            "target_amount": 800000.0,
            "current_amount": 200000.0,
            "monthly_contribution": 10000.0,
            "target_date": "2029-12-31",
            "expected_return_rate": 8.0,
        }
    )
    assert r_a.status_code in [200, 201]
    goal_a_id = r_a.json()["id"]

    # User B attempts to delete Goal A
    del_unauth = client.delete(f"/api/v1/goals/{goal_a_id}", headers=user_b["headers"])
    assert del_unauth.status_code == 404

    # Verify Goal A still exists under User A
    list_a = client.get("/api/v1/goals", headers=user_a["headers"])
    assert list_a.status_code == 200
    assert any(g["id"] == goal_a_id for g in list_a.json())
