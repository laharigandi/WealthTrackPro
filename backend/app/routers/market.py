import re
import math
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status, Query
from cachetools import TTLCache
import yfinance as yf

from app.schemas.market import YahooMarketQuotesResponse

logger = logging.getLogger(__name__)

# 30-second TTL cache for quote entries
quotes_cache = TTLCache(maxsize=300, ttl=30)

router = APIRouter(tags=["Market"])

def get_market_info(symbol: str) -> tuple[str, str, str]:
    sym = symbol.strip().upper()
    if sym.endswith(".NS"):
        mtype = "NSE"
        currency = "INR"
        # NSE Trading hours: Mon-Fri, 9:15 AM - 3:30 PM IST (UTC + 5:30)
        ist_time = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        is_weekend = ist_time.weekday() in (5, 6)
        minutes = ist_time.hour * 60 + ist_time.minute
        is_trading = 555 <= minutes <= 930
        status_str = "LIVE" if (not is_weekend and is_trading) else "MARKET CLOSED"
    elif sym.endswith("-USD"):
        mtype = "CRYPTO"
        currency = "USD"
        status_str = "LIVE"  # Crypto is 24/7
    else:
        mtype = "US"
        currency = "USD"
        # US Market hours: Mon-Fri, 9:30 AM - 4:00 PM Eastern (EST/EDT)
        utc_now = datetime.now(timezone.utc)
        est_offset = -4 if (3 <= utc_now.month <= 10) else -5
        est_time = utc_now + timedelta(hours=est_offset)
        is_weekend = est_time.weekday() in (5, 6)
        minutes = est_time.hour * 60 + est_time.minute
        is_trading = 570 <= minutes <= 960
        status_str = "LIVE" if (not is_weekend and is_trading) else "MARKET CLOSED"
    
    return mtype, currency, status_str

def safe_calc_change(current_price, previous_close):
    if current_price is None or previous_close is None:
        return None, None
    
    try:
        current_price = float(current_price)
        previous_close = float(previous_close)
    except (ValueError, TypeError):
        return None, None

    if math.isnan(current_price) or math.isnan(previous_close):
        return None, None
    if math.isinf(current_price) or math.isinf(previous_close):
        return None, None

    change = round(current_price - previous_close, 2)
    if previous_close == 0:
        change_percent = 0.0
    else:
        raw_percent = ((current_price - previous_close) / previous_close) * 100
        if math.isnan(raw_percent) or math.isinf(raw_percent):
            change_percent = 0.0
        else:
            change_percent = round(raw_percent, 2)
    return change, change_percent

def parse_ticker_data(symbol: str, ticker) -> dict:
    # Try fetching fast_info attributes
    try:
        info = ticker.fast_info
        price = float(getattr(info, "last_price", None) or 0)
        prev_close = float(getattr(info, "previous_close", None) or 0)
    except Exception:
        price = 0
        prev_close = 0

    # Fallback to ticker.info for price
    if price <= 0:
        try:
            t_info = ticker.info
            price = float(t_info.get("regularMarketPrice", None) or 0)
            prev_close = float(t_info.get("regularMarketPreviousClose", None) or t_info.get("previousClose", None) or 0)
        except Exception:
            pass

    if price <= 0:
        raise ValueError(f"No price found for {symbol}")

    change, change_percent = safe_calc_change(price, prev_close)

    # Get currency
    mtype, currency, market_status = get_market_info(symbol)

    # Day High / Low
    try:
        high = float(getattr(ticker.fast_info, "day_high", price) or price)
        low = float(getattr(ticker.fast_info, "day_low", price) or price)
    except Exception:
        high = price
        low = price

    # Safety bounds on high/low (prevent NaN or Inf)
    if math.isnan(high) or math.isinf(high):
        high = price
    if math.isnan(low) or math.isinf(low):
        low = price

    # Company Name
    name = None
    try:
        name = ticker.info.get("longName") or ticker.info.get("shortName")
    except Exception:
        pass

    last_updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "symbol": symbol,
        "name": name or symbol,
        "current_price": price,
        "previous_close": prev_close,
        "change": change,
        "change_percent": change_percent,
        "day_high": round(high, 2),
        "day_low": round(low, 2),
        "currency": currency,
        "market_status": market_status,
        "market_type": mtype,
        "last_updated": last_updated,
        "data_source": "Yahoo Finance",
        "stale": False,
        "error": None
    }


@router.get("/quotes", response_model=YahooMarketQuotesResponse)
def get_market_quotes(
    symbols: str = Query(
        "TCS.NS,RELIANCE.NS,HDFCBANK.NS,INFY.NS,NIFTYBEES.NS,AAPL,MSFT,TSLA,GOLDBEES.NS,BTC-USD,ETH-USD",
        description="Comma-separated ticker symbols"
    )
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

    results = []
    symbols_to_fetch = []

    # 1. Read from TTLCache
    for sym in normalized:
        if sym in quotes_cache:
            results.append(quotes_cache[sym])
        else:
            symbols_to_fetch.append(sym)

    # 2. Fetch uncached symbols using yfinance.Tickers
    if symbols_to_fetch:
        try:
            tickers_group = yf.Tickers(" ".join(symbols_to_fetch))
            for sym in symbols_to_fetch:
                ticker = None
                if hasattr(tickers_group, "tickers"):
                    ticker = (
                        tickers_group.tickers.get(sym) or 
                        tickers_group.tickers.get(sym.upper()) or 
                        tickers_group.tickers.get(sym.lower())
                    )
                if not ticker:
                    ticker = yf.Ticker(sym)

                try:
                    quote_data = parse_ticker_data(sym, ticker)
                    quotes_cache[sym] = quote_data
                    results.append(quote_data)
                except Exception as ex:
                    logger.error(f"Error parsing ticker {sym}: {ex}")
                    mtype, currency, market_status = get_market_info(sym)
                    error_quote = {
                        "symbol": sym,
                        "name": sym,
                        "current_price": None,
                        "previous_close": None,
                        "change": None,
                        "change_percent": None,
                        "day_high": None,
                        "day_low": None,
                        "currency": currency,
                        "market_status": market_status,
                        "market_type": mtype,
                        "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                        "data_source": "Yahoo Finance",
                        "stale": False,
                        "error": f"Failed to fetch market data: {str(ex)}"
                    }
                    results.append(error_quote)
        except Exception as e:
            logger.error(f"Batch fetch failed: {e}. Falling back to single fetch.")
            # Fallback to single fetch
            for sym in symbols_to_fetch:
                try:
                    ticker = yf.Ticker(sym)
                    quote_data = parse_ticker_data(sym, ticker)
                    quotes_cache[sym] = quote_data
                    results.append(quote_data)
                except Exception as ex:
                    mtype, currency, market_status = get_market_info(sym)
                    error_quote = {
                        "symbol": sym,
                        "name": sym,
                        "current_price": None,
                        "previous_close": None,
                        "change": None,
                        "change_percent": None,
                        "day_high": None,
                        "day_low": None,
                        "currency": currency,
                        "market_status": market_status,
                        "market_type": mtype,
                        "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                        "data_source": "Yahoo Finance",
                        "stale": False,
                        "error": f"Failed to fetch: {str(ex)}"
                    }
                    results.append(error_quote)

    # 3. Sort back to requested order
    results_map = {r["symbol"]: r for r in results}
    sorted_results = []
    for sym in normalized:
        if sym in results_map:
            sorted_results.append(results_map[sym])

    fetched_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "quotes": sorted_results,
        "fetched_at": fetched_at,
        "cache_ttl_seconds": 30
    }


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

    # Check cache
    if sym_upper in quotes_cache:
        return quotes_cache[sym_upper]

    # Fetch live
    try:
        ticker = yf.Ticker(sym_upper)
        quote_data = parse_ticker_data(sym_upper, ticker)
        quotes_cache[sym_upper] = quote_data
        return quote_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Symbol '{sym_upper}' not found or data unavailable: {str(e)}"
        )
