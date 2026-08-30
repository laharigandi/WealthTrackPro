from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.transaction import TransactionTypeEnum

class TransactionCreate(BaseModel):
    symbol: str = Field(..., example="TCS")
    asset_name: Optional[str] = Field(None, example="Tata Consultancy Services")
    asset_type: Optional[str] = Field("Stock", example="Stock")
    transaction_type: TransactionTypeEnum = Field(..., example=TransactionTypeEnum.BUY)
    quantity: float = Field(..., gt=0, example=10.0)
    price: float = Field(..., ge=0, example=4200.0)
    notes: Optional[str] = None
    transaction_date: Optional[datetime] = None

class TransactionResponse(BaseModel):
    id: int
    user_id: int
    portfolio_id: Optional[int] = None
    symbol: str
    transaction_type: TransactionTypeEnum
    quantity: float
    price: float
    amount: float
    transaction_date: datetime
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
