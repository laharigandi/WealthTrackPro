from pydantic import BaseModel
from typing import Optional, List

class MarketQuote(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    previous_close: float
    high: float
    low: float
    asset_type: str = "Stock"
    currency: str = "INR"
    last_updated: Optional[str] = None
    live: Optional[bool] = False

class MarketOverviewResponse(BaseModel):
    quotes: List[MarketQuote]

class YahooMarketQuote(BaseModel):
    symbol: str
    name: Optional[str] = None
    current_price: Optional[float] = None
    previous_close: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    currency: str
    market_status: str
    market_type: str
    last_updated: str
    data_source: str = "Yahoo Finance"
    stale: bool = False
    error: Optional[str] = None

class YahooMarketQuotesResponse(BaseModel):
    quotes: List[YahooMarketQuote]
    fetched_at: str
    cache_ttl_seconds: int = 30
