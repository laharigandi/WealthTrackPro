from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base

class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String, nullable=True, default="", index=True)
    normalized_symbol = Column(String, nullable=True, default="", index=True)
    asset_name = Column(String, nullable=False)
    asset_type = Column(String, nullable=False, default="Stock")  # Stock, ETF, Mutual Fund, Crypto, Bond, Cash
    quantity = Column(Float, nullable=False, default=0.0)
    average_buy_price = Column(Float, nullable=False, default=0.0)
    manual_price = Column(Float, nullable=True, default=None)
    price_source = Column(String, nullable=True, default="LIVE")  # LIVE, MANUAL, UNAVAILABLE
    last_price_update = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="portfolios")
    transactions = relationship("Transaction", back_populates="portfolio")

