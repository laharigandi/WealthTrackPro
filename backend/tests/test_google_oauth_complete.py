import time
from urllib.parse import urlparse, parse_qs
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User

client = TestClient(app)

class MockOAuthAsyncClient:
    def __init__(self, email, name, google_id, *args, **kwargs):
        self.email = email
        self.name = name
        self.google_id = google_id

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def post(self, url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"access_token": "fake_google_access_token_123"}
        return resp

    async def get(self, url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {
            "id": self.google_id,
            "email": self.email,
            "name": self.name,
        }
        return resp


def test_google_login_redirect_url():
    """Verify GET /api/v1/auth/google/login constructs valid Google OAuth authorization URL."""
    response = client.get("/api/v1/auth/google/login?state=test_state_123", follow_redirects=False)
    assert response.status_code in (302, 307)
    location = response.headers.get("location")
    assert location is not None
    parsed = urlparse(location)
    assert parsed.netloc == "accounts.google.com"
    assert parsed.path == "/o/oauth2/v2/auth"
    
    query = parse_qs(parsed.query)
    assert "client_id" in query
    assert "redirect_uri" in query
    assert query["response_type"] == ["code"]
    assert "openid" in query["scope"][0]
    assert query["state"] == ["test_state_123"]


def test_google_callback_with_oauth_error():
    """Verify GET /api/v1/auth/google/callback handles error params (e.g. user denied consent)."""
    response = client.get(
        "/api/v1/auth/google/callback?error=access_denied&error_description=The+user+denied+consent",
        follow_redirects=False
    )
    assert response.status_code in (302, 307)
    location = response.headers.get("location")
    assert "/oauth/callback" in location
    assert "error=access_denied" in location


def test_google_callback_missing_code():
    """Verify GET /api/v1/auth/google/callback without code parameter redirects safely to frontend."""
    response = client.get("/api/v1/auth/google/callback", follow_redirects=False)
    assert response.status_code in (302, 307)
    location = response.headers.get("location")
    assert "/oauth/callback" in location
    assert "error=missing_code" in location


def test_google_callback_successful_new_user():
    """Verify GET /api/v1/auth/google/callback creates new user and returns JWTs upon successful OAuth exchange."""
    unique_id = int(time.time() * 1000)
    fake_email = f"google_user_{unique_id}@example.com"
    fake_google_id = f"gid_{unique_id}"
    fake_name = f"Google User {unique_id}"

    mock_client = MockOAuthAsyncClient(email=fake_email, name=fake_name, google_id=fake_google_id)

    with patch("app.api.v1.auth.httpx.AsyncClient", return_value=mock_client):
        response = client.get("/api/v1/auth/google/callback?code=valid_auth_code_123", follow_redirects=False)
        assert response.status_code in (302, 307)
        location = response.headers.get("location")
        assert location is not None
        assert "/oauth/callback" in location

        parsed = urlparse(location)
        query = parse_qs(parsed.query)
        assert "access_token" in query
        assert "refresh_token" in query

        jwt_token = query["access_token"][0]
        # Verify that access token works on /users/me
        me_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {jwt_token}"})
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == fake_email
        assert me_data["name"] == fake_name


def test_google_callback_existing_user_no_duplicate():
    """Verify that logging in with existing user account links google_id and creates no duplicate records."""
    unique_id = int(time.time() * 1000)
    shared_email = f"shared_user_{unique_id}@example.com"
    
    # 1. Register with email/password first
    reg_resp = client.post("/api/v1/auth/register", json={
        "name": "Original Name",
        "email": shared_email,
        "password": "Password123!"
    })
    assert reg_resp.status_code == 201

    # 2. Login via Google with the same email
    fake_google_id = f"gid_shared_{unique_id}"
    mock_client = MockOAuthAsyncClient(email=shared_email, name="Google Updated Name", google_id=fake_google_id)

    with patch("app.api.v1.auth.httpx.AsyncClient", return_value=mock_client):
        response = client.get("/api/v1/auth/google/callback?code=valid_code_456", follow_redirects=False)
        assert response.status_code in (302, 307)
        location = response.headers.get("location")
        parsed = urlparse(location)
        query = parse_qs(parsed.query)
        jwt_token = query["access_token"][0]

        # Verify profile
        me_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {jwt_token}"})
        assert me_resp.status_code == 200

        # Verify DB has exactly 1 user with this email
        db = SessionLocal()
        try:
            users_count = db.query(User).filter(User.email == shared_email).count()
            assert users_count == 1
            user = db.query(User).filter(User.email == shared_email).first()
            assert user.google_id == fake_google_id
        finally:
            db.close()

    # 3. Normal email/password login still works for this user!
    login_resp = client.post("/api/v1/auth/login", json={
        "email": shared_email,
        "password": "Password123!"
    })
    assert login_resp.status_code == 200


def test_google_auth_id_token_post():
    """Verify POST /api/v1/auth/google with Google ID token."""
    unique_id = int(time.time() * 1000)
    fake_email = f"idtoken_user_{unique_id}@example.com"
    fake_sub = f"sub_{unique_id}"

    mock_idinfo = {
        "email": fake_email,
        "sub": fake_sub,
        "name": "ID Token User",
    }

    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_idinfo):
        response = client.post("/api/v1/auth/google", json={"credential": "mock_id_token_string"})
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == fake_email
        assert data["user"]["name"] == "ID Token User"

        # Verify access token
        me_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == fake_email
