from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class PortfolioBase(BaseModel):
    symbol: str = Field(..., example="TCS")
    asset_name: str = Field(..., example="Tata Consultancy Services")
    asset_type: str = Field("Stock", example="Stock")  # Stock, ETF, Mutual Fund, Crypto, Bond
    quantity: float = Field(..., ge=0, example=20.0)
    average_buy_price: float = Field(..., ge=0, example=4000.0)

class PortfolioCreate(PortfolioBase):
    pass

class PortfolioUpdate(BaseModel):
    symbol: Optional[str] = None
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None
    quantity: Optional[float] = Field(None, ge=0)
    average_buy_price: Optional[float] = Field(None, ge=0)

class PortfolioResponse(PortfolioBase):
    id: int
    user_id: int
    current_price: float
    total_investment_value: float
    current_value: float
    profit_loss: float
    profit_loss_percentage: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
