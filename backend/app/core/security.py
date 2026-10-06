from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

from jose import jwt
import bcrypt

from app.config import settings


from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password hashing — uses bcrypt directly (bypasses passlib which has a known
# compatibility bug with bcrypt >= 4.0: it tries to read bcrypt.__about__ which
# was removed, causing pwd_context.hash() to raise a 72-byte truncation error).
# ---------------------------------------------------------------------------

def get_password_hash(password: str) -> str:
    """Return a bcrypt hash of the plain-text password."""
    pw_bytes = password.encode("utf-8")
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        try:
            pw_bytes = plain_password.encode("utf-8")
            hash_bytes = hashed_password.encode("utf-8")
            return bcrypt.checkpw(pw_bytes, hash_bytes)
        except Exception:
            return False


def validate_password_strength(password: str) -> tuple[bool, list[str]]:
    """
    Validate password against security policy:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
    """
    if not password:
        return False, ["at least 8 characters"]
        
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not any(c.isupper() for c in password):
        errors.append("an uppercase letter")
    if not any(c.islower() for c in password):
        errors.append("a lowercase letter")
    if not any(c.isdigit() for c in password):
        errors.append("a number")
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
        errors.append("a special character (!@#$%^&*...)")
        
    if errors:
        return False, errors
    return True, []


# ---------------------------------------------------------------------------
# JWT token creation
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"exp": expire, "sub": str(subject), "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"exp": expire, "sub": str(subject), "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
