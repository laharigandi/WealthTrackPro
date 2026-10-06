from pydantic import BaseModel, Field
from typing import Optional, List

class MarketQuote(BaseModel):
    symbol: str
    normalized_symbol: Optional[str] = None
    name: str
    current_price: Optional[float] = None
    price: Optional[float] = None
    change: Optional[float] = 0.0
    change_percent: Optional[float] = 0.0
    previous_close: Optional[float] = 0.0
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    asset_type: str = "Stock"
    currency: str = "INR"
    currency_symbol: Optional[str] = "₹"
    market_status: Optional[str] = "LIVE"
    market_state: Optional[str] = "LIVE"
    market_type: Optional[str] = "NSE"
    price_source: Optional[str] = "LIVE"
    last_updated: Optional[str] = None
    data_source: Optional[str] = "Yahoo Finance"
    stale: bool = False
    live: Optional[bool] = True
    error: Optional[str] = None
    message: Optional[str] = None

class MarketOverviewResponse(BaseModel):
    quotes: List[MarketQuote]

class YahooMarketQuote(BaseModel):
    symbol: str
    normalized_symbol: Optional[str] = None
    name: Optional[str] = None
    current_price: Optional[float] = None
    price: Optional[float] = None
    previous_close: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    currency: str = "INR"
    currency_symbol: Optional[str] = "₹"
    market_status: str = "LIVE"
    market_state: Optional[str] = "LIVE"
    market_type: str = "NSE"
    asset_type: Optional[str] = "Stock"
    price_source: Optional[str] = "LIVE"
    last_updated: str = ""
    data_source: str = "Yahoo Finance"
    stale: bool = False
    live: Optional[bool] = True
    error: Optional[str] = None
    message: Optional[str] = None

class YahooMarketQuotesResponse(BaseModel):
    quotes: List[YahooMarketQuote]
    fetched_at: str
    cache_ttl_seconds: int = 30
