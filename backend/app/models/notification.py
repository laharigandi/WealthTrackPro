from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)  # e.g., kyc_alert, goal_completed, goal_milestone, portfolio_risk, portfolio_milestone, security
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # e.g., critical, warning, success, info
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    unique_key = Column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "unique_key", name="uq_user_notification_key"),
    )

    user = relationship("User", back_populates="notifications")
