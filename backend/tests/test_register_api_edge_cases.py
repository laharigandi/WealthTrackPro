import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_registration_password_validation_api():
    # 1. Invalid short password
    res = client.post("/api/v1/auth/register", json={
        "name": "Test User",
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "short"
    })
    assert res.status_code == 400
    assert "Password does not meet security requirements" in res.json()["detail"]
    assert "at least 8 characters" in res.json()["detail"]

    # 2. No uppercase
    res = client.post("/api/v1/auth/register", json={
        "name": "Test User",
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "password123!@#"
    })
    assert res.status_code == 400
    assert "uppercase letter" in res.json()["detail"]

    # 3. No number
    res = client.post("/api/v1/auth/register", json={
        "name": "Test User",
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "Password!@#$"
    })
    assert res.status_code == 400
    assert "number" in res.json()["detail"]

    # 4. No special character
    res = client.post("/api/v1/auth/register", json={
        "name": "Test User",
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "Password1234"
    })
    assert res.status_code == 400
    assert "special character" in res.json()["detail"]

    # 5. Valid password registration
    valid_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    valid_password = "SecurePassword123!"
    res = client.post("/api/v1/auth/register", json={
        "name": "Valid User",
        "email": valid_email,
        "password": valid_password
    })
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == valid_email
    assert "password" not in data  # password not leaked

    # 6. Login with the newly registered user
    login_res = client.post("/api/v1/auth/login", json={
        "email": valid_email,
        "password": valid_password
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == valid_email

    print("ALL API REGISTRATION & LOGIN TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_registration_password_validation_api()
