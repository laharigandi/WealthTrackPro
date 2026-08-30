import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.models.user import User, RiskProfileEnum, KYCStatusEnum
from app.models.notification import Notification
from app.core.security import get_password_hash
from app.api.v1 import auth, users, goals, portfolio, transactions, advisor, calculator, report, notifications
from app.routers import market as market_router

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Create tables & seed demo user on startup
# ---------------------------------------------------------------------------
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified / created.")
    
    # Auto-seed default test user (john@example.com / password123)
    db = SessionLocal()
    try:
        demo_email = "john@example.com"
        existing = db.query(User).filter(User.email == demo_email).first()
        if not existing:
            demo_user = User(
                name="John Doe",
                email=demo_email,
                password=get_password_hash("password123"),
                risk_profile=RiskProfileEnum.moderate,
                kyc_status=KYCStatusEnum.verified,
            )
            db.add(demo_user)
            db.commit()
            logger.info("Default demo user (john@example.com / password123) seeded successfully.")
    except Exception as seed_exc:
        logger.warning("Could not seed demo user: %s", seed_exc)
    finally:
        db.close()

except Exception as exc:
    logger.warning("Could not create DB tables on startup: %s", exc)

# ---------------------------------------------------------------------------
# Google OAuth Configuration Validation
# ---------------------------------------------------------------------------
missing_google_vars = []
if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID.lower() in ("your_google_client_id", "your_client_id", ""):
    missing_google_vars.append("GOOGLE_CLIENT_ID")
if not settings.GOOGLE_CLIENT_SECRET or settings.GOOGLE_CLIENT_SECRET.lower() in ("your_google_client_secret", "your_client_secret", ""):
    missing_google_vars.append("GOOGLE_CLIENT_SECRET")
if not settings.GOOGLE_REDIRECT_URI:
    missing_google_vars.append("GOOGLE_REDIRECT_URI")

if missing_google_vars:
    logger.warning(f"Google OAuth configuration: MISSING {', '.join(missing_google_vars)}. Google login will not work.")
else:
    logger.info("Google OAuth configuration: READY")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow Vite dev server and any localhost variant
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(goals.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(market_router.router, prefix="/api/v1/market")
app.include_router(advisor.router, prefix="/api/v1")
app.include_router(calculator.router, prefix="/api/v1")
app.include_router(report.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/", tags=["Health"])
def health_check():
    return {"status": "online", "project": settings.PROJECT_NAME}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
