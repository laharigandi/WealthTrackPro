import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base

class RiskProfileEnum(str, enum.Enum):
    conservative = "conservative"
    moderate = "moderate"
    aggressive = "aggressive"

class KYCStatusEnum(str, enum.Enum):
    pending = "pending"
    unverified = "unverified"
    verified = "verified"
    rejected = "rejected"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=True)
    auth_provider = Column(String, default="email", nullable=False)
    google_id = Column(String, unique=True, index=True, nullable=True)
    risk_profile = Column(
        Enum(RiskProfileEnum, name="risk_profile_enum"),
        default=RiskProfileEnum.moderate,
        nullable=False
    )
    kyc_status = Column(
        Enum(KYCStatusEnum, name="kyc_status_enum"),
        default=KYCStatusEnum.pending,
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")