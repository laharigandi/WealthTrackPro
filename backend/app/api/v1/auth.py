from typing import Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
import httpx
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_db
from app.models.user import User, RiskProfileEnum, KYCStatusEnum
from app.schemas.user import UserRegister, UserLogin, UserProfileResponse
from app.schemas.token import Token, RefreshTokenRequest
from app.core.security import (
    verify_password,
    get_password_hash,
    validate_password_strength,
    create_access_token,
    create_refresh_token,
)
from app.config import settings
from app.services.notifications import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    """
    Create a new user account.
    Accepts JSON: { "name": "...", "email": "...", "password": "..." }
    Returns the created user profile (no password).
    """
    # ── Strong password validation ──────────────────────────────
    is_valid, errors = validate_password_strength(user_in.password or "")
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password does not meet security requirements. Must contain: {', '.join(errors)}.",
        )

    email_clean = user_in.email.strip().lower()
    if db.query(User).filter(User.email == email_clean).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered.",
        )
    new_user = User(
        name=user_in.name.strip(),
        email=email_clean,
        password=get_password_hash(user_in.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    try:
        NotificationService.evaluate_user_alerts(db, new_user)
    except Exception:
        pass

    return new_user


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user and return JWT access + refresh tokens.
    Accepts JSON: { "email": "...", "password": "..." }

    NOTE: Previously used OAuth2PasswordRequestForm (form-urlencoded), which
    conflicted with Axios sending application/json — the form dependency consumed
    the body first, leaving nothing for request.json() to read. Fixed by using
    the UserLogin Pydantic model directly, which FastAPI parses from the JSON body.
    """
    email_clean = user_in.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user or not verify_password(user_in.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    # Record idempotent security login notification event and sync active alerts
    try:
        NotificationService.record_security_event(db, user)
        NotificationService.evaluate_user_alerts(db, user)
    except Exception:
        pass

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "risk_profile": user.risk_profile or "Moderate",
            "kyc_status": user.kyc_status or "verified"
        }
    }


@router.post("/refresh", response_model=Token)
def refresh_token(token_req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Issue a new access token using a valid refresh token.
    """
    invalid_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )
    try:
        payload = jwt.decode(
            token_req.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if not user_id or token_type != "refresh":
            raise invalid_exc
    except JWTError:
        raise invalid_exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return {
        "access_token": create_access_token(subject=user.id),
        "refresh_token": create_refresh_token(subject=user.id),
        "token_type": "bearer",
    }


@router.get("/google/login")
def google_login(state: Optional[str] = None):
    """
    Redirect the user to Google's OAuth 2.0 consent screen.
    """
    missing_vars = []
    if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID.lower() in ("your_google_client_id", "your_client_id", ""):
        missing_vars.append("GOOGLE_CLIENT_ID")
    if not settings.GOOGLE_CLIENT_SECRET or settings.GOOGLE_CLIENT_SECRET.lower() in ("your_google_client_secret", "your_client_secret", ""):
        missing_vars.append("GOOGLE_CLIENT_SECRET")
    if not settings.GOOGLE_REDIRECT_URI:
        missing_vars.append("GOOGLE_REDIRECT_URI")
        
    if missing_vars:
        logger.error(f"Google OAuth configuration missing: {', '.join(missing_vars)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Google OAuth is not configured. Set {', '.join(missing_vars)}."
        )
        
    scope = "openid email profile"
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={settings.GOOGLE_REDIRECT_URI}&"
        f"scope={scope}&"
        f"access_type=offline&"
        f"prompt=select_account"
    )
    if state:
        url += f"&state={state}"
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Handle the OAuth callback from Google.
    """
    if error:
        logger.warning(f"Google OAuth callback received error: {error} ({error_description})")
        err_msg = error_description or "Google authentication was cancelled or failed."
        return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?error={error}&error_description={err_msg}")

    if not code:
        logger.warning("Google OAuth callback called without authorization code.")
        return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?error=missing_code&error_description=Missing authorization code from Google")

    missing_vars = []
    if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID.lower() in ("your_google_client_id", "your_client_id", ""):
        missing_vars.append("GOOGLE_CLIENT_ID")
    if not settings.GOOGLE_CLIENT_SECRET or settings.GOOGLE_CLIENT_SECRET.lower() in ("your_google_client_secret", "your_client_secret", ""):
        missing_vars.append("GOOGLE_CLIENT_SECRET")
    if not settings.GOOGLE_REDIRECT_URI:
        missing_vars.append("GOOGLE_REDIRECT_URI")
        
    if missing_vars:
        logger.error(f"Google OAuth configuration missing on server: {', '.join(missing_vars)}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?error=config_error&error_description=Google OAuth is not configured on the server")
        
    # Exchange code for token
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_response = await client.post(token_url, data=token_data)
            if token_response.status_code != 200:
                logger.error(f"Failed to exchange Google token. Status code: {token_response.status_code}")
                return RedirectResponse(
                    f"{settings.FRONTEND_URL}/oauth/callback?error=token_exchange_failed&error_description=Failed to exchange Google authorization code"
                )
                
            google_access_token = token_response.json().get("access_token")
            if not google_access_token:
                logger.error("No access token returned by Google")
                return RedirectResponse(
                    f"{settings.FRONTEND_URL}/oauth/callback?error=no_access_token&error_description=No access token received from Google"
                )
            
            # Get user profile info
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            userinfo_response = await client.get(
                userinfo_url, headers={"Authorization": f"Bearer {google_access_token}"}
            )
            if userinfo_response.status_code != 200:
                logger.error(f"Failed to fetch Google user info. Status code: {userinfo_response.status_code}")
                return RedirectResponse(
                    f"{settings.FRONTEND_URL}/oauth/callback?error=userinfo_failed&error_description=Failed to retrieve user profile from Google"
                )
                
            google_user = userinfo_response.json()
    except Exception as exc:
        logger.error(f"Unexpected exception during Google OAuth exchange: {type(exc).__name__}")
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/oauth/callback?error=oauth_network_error&error_description=Communication with Google failed"
        )
        
    email = google_user.get("email")
    google_id = str(google_user.get("id")) if google_user.get("id") else None
    name = google_user.get("name")
    
    if not email:
        logger.error("No email provided by Google")
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/oauth/callback?error=missing_email&error_description=No email address provided by Google account"
        )
        
    email_clean = email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    
    if not user:
        # Create new user
        user = User(
            name=name.strip() if name else email_clean.split("@")[0],
            email=email_clean,
            password=None,  # No password for Google users
            auth_provider="google",
            google_id=google_id,
            risk_profile=RiskProfileEnum.moderate,
            kyc_status=KYCStatusEnum.verified,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Link existing user if needed
        updated = False
        if not user.google_id and google_id:
            user.google_id = google_id
            updated = True
        if updated:
            db.commit()
            db.refresh(user)
            
    # Record idempotent security login notification event and sync active alerts
    try:
        NotificationService.record_security_event(db, user)
        NotificationService.evaluate_user_alerts(db, user)
    except Exception:
        pass

    # Generate our JWTs
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    # Redirect to frontend with tokens
    redirect_url = f"{settings.FRONTEND_URL}/oauth/callback?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(redirect_url)


class GoogleLoginRequest(BaseModel):
    credential: str


@router.post("/google", response_model=Token)
def google_auth(token_in: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user via Google ID token (credential).
    """
    try:
        aud = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
        idinfo = id_token.verify_oauth2_token(
            token_in.credential,
            google_requests.Request(),
            audience=aud
        )
        
        email = idinfo.get("email")
        google_id = str(idinfo.get("sub")) if idinfo.get("sub") else None
        name = idinfo.get("name")
    except ValueError as e:
        logger.warning(f"Google ID token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Google token: {str(e)}"
        )
    except Exception as e:
        logger.warning(f"Google auth verification unexpected error: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication failed."
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token does not contain email."
        )

    email_clean = email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user:
        user = User(
            name=name.strip() if name else email_clean.split("@")[0],
            email=email_clean,
            password=None,
            auth_provider="google",
            google_id=google_id,
            risk_profile=RiskProfileEnum.moderate,
            kyc_status=KYCStatusEnum.verified,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.google_id and google_id:
            user.google_id = google_id
            db.commit()
            db.refresh(user)

    # Record idempotent security login notification event and sync active alerts
    try:
        NotificationService.record_security_event(db, user)
        NotificationService.evaluate_user_alerts(db, user)
    except Exception:
        pass

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "risk_profile": user.risk_profile.value if hasattr(user.risk_profile, "value") else (user.risk_profile or "moderate"),
            "kyc_status": user.kyc_status.value if hasattr(user.kyc_status, "value") else (user.kyc_status or "verified"),
        }
    }
