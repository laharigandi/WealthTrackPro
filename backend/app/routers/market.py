import re
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query

from app.schemas.market import YahooMarketQuotesResponse, YahooMarketQuote, MarketOverviewResponse, MarketQuote
from app.services.market_service import MarketService, normalize_symbol_for_yahoo, DEFAULT_WATCHLIST

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Market"])


@router.get("/quotes", response_model=YahooMarketQuotesResponse)
def get_market_quotes(
    symbols: str = Query(
        ",".join(DEFAULT_WATCHLIST),
        description="Comma-separated ticker symbols"
    ),
    refresh: bool = Query(False, description="Force refresh cache")
):
    if not symbols or not symbols.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Symbols parameter cannot be empty."
        )

    # Normalize symbols: trim, uppercase, remove empty, remove duplicates
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
            detail="No valid symbols provided."
        )

    if len(normalized) > 25:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum of 25 symbols allowed per request."
        )

    # Symbol format validation (alphanumeric, dot, dash, equal, colon)
    pattern = re.compile(r"^[A-Z0-9.\-=:]+$")
    for s in normalized:
        if not pattern.match(s):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid symbol format: {s}"
            )

    try:
        quotes = MarketService.get_quotes_batch(normalized, force_refresh=refresh)
        fetched_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return {
            "quotes": quotes,
            "fetched_at": fetched_at,
            "cache_ttl_seconds": 30
        }
    except Exception as e:
        logger.error(f"[MARKET_ROUTER_ERROR] Failed to fetch quotes for {symbols}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Market data service temporarily unavailable: {str(e)}"
        )


@router.get("/overview", response_model=MarketOverviewResponse)
def get_market_overview():
    """Return default market watchlist with live prices."""
    quotes = MarketService.get_market_overview()
    return {"quotes": quotes}


@router.get("/search")
def search_market_symbol(
    symbol: str = Query(..., description="Ticker symbol to search")
):
    if not symbol or not symbol.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Symbol parameter cannot be empty."
        )

    sym_upper = symbol.strip().upper()
    try:
        quote = MarketService.search_symbol(sym_upper)
        return quote
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"[MARKET_SEARCH_ERROR] Error searching symbol {sym_upper}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Market data temporarily unavailable for {sym_upper}."
        )


@router.get("/search/{symbol}")
def search_market_symbol_path(symbol: str):
    """Path parameter variant for symbol search."""
    return search_market_symbol(symbol=symbol)


@router.get("/{symbol}")
def get_single_market_quote(symbol: str):
    """Get single quote by ticker."""
    if not symbol or not symbol.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Symbol parameter cannot be empty."
        )
    try:
        return MarketService.get_quote(symbol.strip())
    except Exception as e:
        logger.error(f"[MARKET_QUOTE_ERROR] Error fetching single quote {symbol}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Market data unavailable for {symbol}."
        )
