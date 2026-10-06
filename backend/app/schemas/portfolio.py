from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class PortfolioBase(BaseModel):
    symbol: Optional[str] = Field(None, example="TCS")
    asset_name: str = Field(..., example="Tata Consultancy Services")
    asset_type: str = Field("Stock", example="Stock")  # Stock, ETF, Mutual Fund, Crypto, Bond, Cash
    quantity: float = Field(..., ge=0, example=20.0)
    average_buy_price: float = Field(..., ge=0, example=4000.0)
    manual_price: Optional[float] = Field(None, ge=0, example=4000.0)

class PortfolioCreate(PortfolioBase):
    pass

class PortfolioUpdate(BaseModel):
    symbol: Optional[str] = None
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None
    quantity: Optional[float] = Field(None, ge=0)
    average_buy_price: Optional[float] = Field(None, ge=0)
    manual_price: Optional[float] = Field(None, ge=0)

class PortfolioResponse(BaseModel):
    id: int
    user_id: int
    symbol: Optional[str] = ""
    normalized_symbol: Optional[str] = ""
    asset_name: str
    asset_type: str
    quantity: float
    average_buy_price: float
    manual_price: Optional[float] = None
    current_price: Optional[float] = None
    total_investment_value: float
    current_value: Optional[float] = None
    profit_loss: Optional[float] = None
    profit_loss_percentage: Optional[float] = None
    price_source: str = "LIVE"  # "LIVE", "MANUAL", "UNAVAILABLE"
    price_status: str = "Live"  # "Live", "Manual", "Live unavailable"
    is_realtime: bool = True
    last_price_update: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True



