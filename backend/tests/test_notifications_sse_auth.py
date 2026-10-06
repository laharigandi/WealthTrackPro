import time
from datetime import datetime, timedelta, timezone
from jose import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.models.notification import Notification
from app.api.v1.notifications import get_user_from_token_or_query

client = TestClient(app, raise_server_exceptions=False)


def create_test_user():
    email = f"sse_test_{int(time.time() * 1000)}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "SSE Tester",
        "email": email,
        "password": "Password123!"
    })
    assert r.status_code == 201

    r_login = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    assert r_login.status_code == 200
    data = r_login.json()
    return {
        "email": email,
        "user_id": data["user"]["id"],
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
    }


def cleanup_user(user_info):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_info["user_id"]).first()
        if user:
            db.query(Notification).filter(Notification.user_id == user.id).delete()
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_sse_dependency_valid_query_token():
    u = create_test_user()
    db = SessionLocal()
    try:
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/notifications/stream",
            "headers": [],
        }
        req = Request(scope)
        user = get_user_from_token_or_query(request=req, token=u["access_token"], db=db)
        assert user is not None
        assert user.id == u["user_id"]
    finally:
        db.close()
        cleanup_user(u)


def test_sse_dependency_valid_auth_header():
    u = create_test_user()
    db = SessionLocal()
    try:
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/notifications/stream",
            "headers": [(b"authorization", f"Bearer {u['access_token']}".encode("latin-1"))],
        }
        req = Request(scope)
        user = get_user_from_token_or_query(request=req, token=None, db=db)
        assert user is not None
        assert user.id == u["user_id"]
    finally:
        db.close()
        cleanup_user(u)


def test_sse_stream_missing_token_returns_401():
    res = client.get("/api/v1/notifications/stream")
    assert res.status_code == 401
    assert "token required" in res.json().get("detail", "").lower()


def test_sse_stream_invalid_token_returns_401():
    res = client.get("/api/v1/notifications/stream?token=invalid_garbage_token_123")
    assert res.status_code == 401


def test_sse_stream_expired_token_returns_401():
    u = create_test_user()
    try:
        expired_payload = {
            "sub": str(u["user_id"]),
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=10)
        }
        expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        res = client.get(f"/api/v1/notifications/stream?token={expired_token}")
        assert res.status_code == 401
    finally:
        cleanup_user(u)


def test_sse_stream_refresh_token_rejected_as_access_token():
    u = create_test_user()
    try:
        res = client.get(f"/api/v1/notifications/stream?token={u['refresh_token']}")
        assert res.status_code == 401
    finally:
        cleanup_user(u)


def test_sse_stream_refreshed_token_succeeds():
    u = create_test_user()
    db = SessionLocal()
    try:
        # Pause 1.1s so refreshed token gets a new exp/iat timestamp
        time.sleep(1.1)

        # Refresh the token
        r_ref = client.post("/api/v1/auth/refresh", json={"refresh_token": u["refresh_token"]})
        assert r_ref.status_code == 200
        new_access_token = r_ref.json()["access_token"]
        assert new_access_token != u["access_token"]

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/notifications/stream",
            "headers": [],
        }
        req = Request(scope)
        user = get_user_from_token_or_query(request=req, token=new_access_token, db=db)
        assert user is not None
        assert user.id == u["user_id"]
    finally:
        db.close()
        cleanup_user(u)
