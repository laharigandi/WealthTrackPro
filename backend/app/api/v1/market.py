import re
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Query

from app.schemas.market import MarketQuote, MarketOverviewResponse, YahooMarketQuotesResponse
from app.services.market_service import MarketService

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/quotes", response_model=YahooMarketQuotesResponse)
def get_market_quotes(
    symbols: str = Query(..., description="Comma-separated list of symbols to fetch"),
):
    if not symbols or not symbols.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Symbols parameter cannot be empty.",
        )

    # 1. Normalize symbols list
    raw_list = [s.strip().upper() for s in symbols.split(",")]
    normalized = []
    seen = set()
    for s in raw_list:
        if s and s not in seen:
            seen.add(s)
            normalized.append(s)

    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid symbols provided.",
        )

    # 2. Limit maximum count
    if len(normalized) > 25:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum of 25 symbols allowed per request.",
        )

    # 3. Validate symbol character format (alphanumeric, dot, dash, equal, colon)
    pattern = re.compile(r"^[A-Z0-9.\-=:]+$")
    for s in normalized:
        if not pattern.match(s):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid symbol format: {s}",
            )

    # 4. Fetch quotes
    try:
        quotes = MarketService.get_quotes_batch(normalized)
        fetched_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return {
            "quotes": quotes,
            "fetched_at": fetched_at,
            "cache_ttl_seconds": 30,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        )


@router.get("", response_model=MarketOverviewResponse)
def get_market_overview():
    """Return default market watchlist with prices."""
    quotes = MarketService.get_market_overview()
    return {"quotes": quotes}


@router.get("/search/{symbol}")
def search_market_symbol(symbol: str):
    """
    Live symbol search — tries yfinance first.
    Use for: TCS, RELIANCE.NS, AAPL, BTC-USD, ETH-USD, etc.
    """
    if not symbol or len(symbol.strip()) < 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Symbol cannot be empty.",
        )
    try:
        quote = MarketService.search_symbol(symbol.strip())
        return quote
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Market data temporarily unavailable for {symbol.upper()}. Please try again.",
        )


@router.get("/{symbol}", response_model=MarketQuote)
def get_market_quote(symbol: str):
    """Get quote for a specific symbol."""
    quote = MarketService.get_quote(symbol)
    return quote
