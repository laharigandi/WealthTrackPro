import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.models.user import User, RiskProfileEnum, KYCStatusEnum
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.models.notification import Notification
from app.core.security import get_password_hash
from app.services.market_service import normalize_symbol_for_yahoo
from app.services.portfolio_calc import reconcile_all_user_holdings
from app.services.notifications import NotificationService
from app.api.v1 import auth, users, goals, portfolio, transactions, advisor, calculator, report, notifications
from app.routers import market as market_router

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database schema verification, auto-healing migration & seed
# ---------------------------------------------------------------------------
def heal_database_records(db):
    """Auto-heal legacy/corrupted symbols (.NA -> .NS, unnormalized tickers) safely and quickly."""
    try:
        db.execute(text("UPDATE portfolios SET symbol = REPLACE(symbol, '.NA', '.NS') WHERE symbol LIKE '%.NA'"))
        db.execute(text("UPDATE transactions SET symbol = REPLACE(symbol, '.NA', '.NS') WHERE symbol LIKE '%.NA'"))
        db.commit()
        logger.info("Database auto-healing verification complete.")
    except Exception as e:
        db.rollback()
        logger.warning(f"Database auto-healing note: {e}")


def init_db_and_heal():
    try:
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            for col_sql in [
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS normalized_symbol VARCHAR;",
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS manual_price DOUBLE PRECISION;",
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS price_source VARCHAR;",
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP WITH TIME ZONE;",
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();",
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR;",
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id INTEGER;",
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS milestone DOUBLE PRECISION;",
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_notification_key ON notifications (user_id, unique_key);",
            ]:
                try:
                    conn.execute(text(col_sql))
                    conn.commit()
                except Exception:
                    pass
        logger.info("Database tables and columns verified / created.")
        
        # Auto-heal existing database records and seed default test user (development only)
        db = SessionLocal()
        try:
            heal_database_records(db)
            is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "local", "test")
            allow_seeding = settings.SEED_DEMO_USER and (
                is_dev or os.getenv("SEED_DEMO_USER", "").lower() in ("true", "1", "yes")
            )
            if allow_seeding:
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
            else:
                logger.info("Demo user seeding skipped (production environment or SEED_DEMO_USER disabled).")
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

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        import asyncio
        from app.services.notifications import notification_stream_manager
        loop = asyncio.get_running_loop()
        notification_stream_manager.set_loop(loop)
        logger.info("Notification stream manager initialized with main asyncio event loop.")
    except Exception as e:
        logger.warning(f"Could not register main event loop on startup: {e}")

    try:
        init_db_and_heal()
    except Exception as e:
        logger.warning(f"Could not run init_db_and_heal on startup: {e}")

    yield

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow Vite dev server, localhost variants, and configured FRONTEND_URL
# ---------------------------------------------------------------------------
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

# Safely add the production frontend URL from settings if provided
if settings.FRONTEND_URL:
    for url in settings.FRONTEND_URL.split(","):
        cleaned_url = url.strip().rstrip("/")
        if cleaned_url and cleaned_url not in allowed_origins:
            allowed_origins.append(cleaned_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
