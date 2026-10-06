import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_registration_does_not_authenticate():
    """
    Test 1: Registration creates user but does not return auth token.
    Test 3: Logging in with registered credentials works and returns tokens.
    Test 4: Logging in with wrong password fails.
    """
    test_email = "manual_flow_user@example.com"
    test_password = "Password123!"
    test_name = "Manual Flow User"

    # Step 1: Register
    reg_response = client.post(
        "/api/v1/auth/register",
        json={"name": test_name, "email": test_email, "password": test_password}
    )
    # Registration must succeed (201 Created or 400 if already created)
    if reg_response.status_code == 201:
        reg_data = reg_response.json()
        assert "access_token" not in reg_data
        assert "refresh_token" not in reg_data
        assert reg_data["email"] == test_email
        assert reg_data["name"] == test_name

    # Step 2: Failed login with incorrect password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": "WrongPassword123!"}
    )
    assert bad_login.status_code == 401 or bad_login.status_code == 400

    # Step 3: Successful login with correct credentials
    good_login = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": test_password}
    )
    assert good_login.status_code == 200
    login_data = good_login.json()
    assert "access_token" in login_data
    assert "refresh_token" in login_data
    assert login_data["user"]["email"] == test_email
