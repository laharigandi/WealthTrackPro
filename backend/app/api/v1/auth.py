from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
import httpx
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserProfileResponse
from app.schemas.token import Token, RefreshTokenRequest
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
)
from app.config import settings

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
    pwd = user_in.password
    errors = []
    if len(pwd) < 8:
        errors.append("at least 8 characters")
    if not any(c.isupper() for c in pwd):
        errors.append("an uppercase letter")
    if not any(c.islower() for c in pwd):
        errors.append("a lowercase letter")
    if not any(c.isdigit() for c in pwd):
        errors.append("a number")
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in pwd):
        errors.append("a special character (!@#$%^&*...)")
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password must contain: {', '.join(errors)}.",
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

    return {
        "access_token": create_access_token(subject=user.id),
        "refresh_token": create_refresh_token(subject=user.id),
        "token_type": "bearer",
        "user": user,
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
def google_login():
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
        f"access_type=offline"
    )
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """
    Handle the OAuth callback from Google.
    """
    missing_vars = []
    if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID.lower() in ("your_google_client_id", "your_client_id", ""):
        missing_vars.append("GOOGLE_CLIENT_ID")
    if not settings.GOOGLE_CLIENT_SECRET or settings.GOOGLE_CLIENT_SECRET.lower() in ("your_google_client_secret", "your_client_secret", ""):
        missing_vars.append("GOOGLE_CLIENT_SECRET")
    if not settings.GOOGLE_REDIRECT_URI:
        missing_vars.append("GOOGLE_REDIRECT_URI")
        
    if missing_vars:
        raise HTTPException(
            status_code=500, 
            detail=f"Google OAuth is not configured. Set {', '.join(missing_vars)}."
        )
        
    # Exchange code for token
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
    }
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=token_data)
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google token")
            
        google_access_token = token_response.json().get("access_token")
        
        # Get user profile info
        userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        userinfo_response = await client.get(
            userinfo_url, headers={"Authorization": f"Bearer {google_access_token}"}
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
            
        google_user = userinfo_response.json()
        
    email = google_user.get("email")
    google_id = google_user.get("id")
    name = google_user.get("name")
    
    if not email:
        raise HTTPException(status_code=400, detail="No email provided by Google")
        
    email_clean = email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    
    if not user:
        # Create new user
        user = User(
            name=name or email_clean.split("@")[0],
            email=email_clean,
            password=None,  # No password for Google users
            auth_provider="google",
            google_id=google_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Link existing user if needed
        if not user.google_id:
            user.google_id = google_id
            if user.auth_provider == "email":
                user.auth_provider = "google"
            db.commit()
            db.refresh(user)
            
    # Generate our JWTs
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    # Redirect to frontend with tokens
    redirect_url = f"{settings.FRONTEND_URL}/oauth/callback?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(redirect_url)
