import time
import math
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import yfinance as yf

# Silence verbose third-party loggers
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
logging.getLogger("urllib3").setLevel(logging.CRITICAL)

logger = logging.getLogger(__name__)

# Global in-memory cache: {symbol_upper: {"data": quote_dict, "timestamp": float}}
_quotes_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 30  # seconds

# Global in-memory negative cache: {symbol_upper: timestamp}
_negative_cache: Dict[str, float] = {}
NEGATIVE_CACHE_TTL = 60  # seconds

SYMBOL_MAP: Dict[str, str] = {
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "INFY": "INFY.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "SBIN": "SBIN.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "ITC": "ITC.NS",
    "KOTAKBANK": "KOTAKBANK.NS",
    "LT": "LT.NS",
    "AXISBANK": "AXISBANK.NS",
    "TATAMOTORS": "TATAMOTORS.NS",
    "MARUTI": "MARUTI.NS",
    "WIPRO": "WIPRO.NS",
    "HCLTECH": "HCLTECH.NS",
    "NIFTYBEES": "NIFTYBEES.NS",
    "GOLDBEES": "GOLDBEES.NS",
    "JUNIORBEES": "JUNIORBEES.NS",
    "BANKBEES": "BANKBEES.NS",
    "LIQUIDBEES": "LIQUIDBEES.NS",
}

COMPANY_NAMES: Dict[str, str] = {
    "TCS.NS": "Tata Consultancy Services Limited",
    "RELIANCE.NS": "Reliance Industries Limited",
    "HDFCBANK.NS": "HDFC Bank Limited",
    "INFY.NS": "Infosys Limited",
    "ICICIBANK.NS": "ICICI Bank Limited",
    "SBIN.NS": "State Bank of India",
    "BHARTIARTL.NS": "Bharti Airtel Limited",
    "ITC.NS": "ITC Limited",
    "KOTAKBANK.NS": "Kotak Mahindra Bank Limited",
    "LT.NS": "Larsen & Toubro Limited",
    "AXISBANK.NS": "Axis Bank Limited",
    "TATAMOTORS.NS": "Tata Motors Limited",
    "MARUTI.NS": "Maruti Suzuki India Limited",
    "WIPRO.NS": "Wipro Limited",
    "HCLTECH.NS": "HCL Technologies Limited",
    "NIFTYBEES.NS": "Nippon India ETF Nifty BeES",
    "GOLDBEES.NS": "Nippon India ETF Gold BeES",
    "JUNIORBEES.NS": "Nippon India ETF Junior BeES",
    "BANKBEES.NS": "Nippon India ETF Bank BeES",
    "LIQUIDBEES.NS": "Nippon India ETF Liquid BeES",
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "TSLA": "Tesla, Inc.",
    "GOOG": "Alphabet Inc.",
    "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com, Inc.",
    "NVDA": "NVIDIA Corporation",
    "META": "Meta Platforms, Inc.",
    "BTC-USD": "Bitcoin (USD)",
    "ETH-USD": "Ethereum (USD)",
    "SOL-USD": "Solana (USD)",
    "HDFCBALANCED": "HDFC Balanced Advantage Fund",
}

DEFAULT_PRICES: Dict[str, float] = {
    "RELIANCE.NS": 2980.0,
    "TCS.NS": 3950.0,
    "HDFCBANK.NS": 1640.0,
    "INFY.NS": 1820.0,
    "ICICIBANK.NS": 1210.0,
    "SBIN.NS": 790.0,
    "BHARTIARTL.NS": 1540.0,
    "ITC.NS": 490.0,
    "KOTAKBANK.NS": 1780.0,
    "LT.NS": 3650.0,
    "AXISBANK.NS": 1180.0,
    "TATAMOTORS.NS": 980.0,
    "MARUTI.NS": 12400.0,
    "WIPRO.NS": 530.0,
    "HCLTECH.NS": 1750.0,
    "NIFTYBEES.NS": 265.0,
    "GOLDBEES.NS": 68.0,
    "JUNIORBEES.NS": 740.0,
    "BANKBEES.NS": 520.0,
    "LIQUIDBEES.NS": 1000.0,
}

DEFAULT_WATCHLIST = [
    "TCS.NS",
    "RELIANCE.NS",
    "HDFCBANK.NS",
    "INFY.NS",
    "AAPL",
    "MSFT",
    "TSLA",
    "BTC-USD",
    "ETH-USD"
]

KNOWN_US_SYMBOLS = {
    "AAPL", "MSFT", "TSLA", "GOOG", "GOOGL", "AMZN", "NVDA", "META",
    "NFLX", "SPY", "QQQ", "VTI", "VOO", "DIA", "BND", "GLD", "SLV", "AMD", "INTC", "BRK-B"
}

KNOWN_CRYPTO_SYMBOLS = {
    "BTC", "ETH", "SOL", "USDT", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC"
}


def get_currency_symbol(currency: str) -> str:
    if not currency:
        return ""
    curr = currency.upper().strip()
    if curr == "INR":
        return "₹"
    elif curr == "USD":
        return "$"
    elif curr == "EUR":
        return "€"
    elif curr == "GBP":
        return "£"
    return ""


def get_market_info(symbol: str) -> tuple[str, str, str]:
    sym = symbol.strip().upper()
    if sym.endswith(".NS") or sym.endswith(".BO"):
        mtype = "NSE" if sym.endswith(".NS") else "BSE"
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


def safe_calc_change(current_price: Optional[float], previous_close: Optional[float]) -> tuple[Optional[float], Optional[float]]:
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


def normalize_market_symbol(symbol: str, asset_type: str = "Stock") -> str:
    """
    Centralized, asset-type aware canonical normalization of market symbols:
    - "tcs" + Stock -> "TCS.NS"
    - "TCS.NS" + Stock -> "TCS.NS"
    - "reliance" + Stock -> "RELIANCE.NS"
    - "HDFCBANK" + Stock -> "HDFCBANK.NS"
    - "AAPL" + Stock -> "AAPL"
    - "BTC" + Crypto -> "BTC-USD"
    - "BTC-USD" + Crypto -> "BTC-USD"
    - "HDFCBALANCED" + Mutual Fund -> "HDFCBALANCED" (DO NOT append .NS)
    - "HDFCBALANCED.NS" + Mutual Fund -> "HDFCBALANCED"
    - "Cash" / "Bond" / "FD" -> ""
    """
    if not symbol or not str(symbol).strip():
        return ""
    
    clean_type = (asset_type or "Stock").strip().lower()
    if clean_type in ["bond", "fixed deposit", "fd", "cash"]:
        return ""

    # Remove all whitespace and uppercase
    s = re.sub(r'\s+', '', str(symbol)).upper()

    # 1. Mutual Fund handling: NEVER append .NS or exchange suffixes
    if clean_type in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
        if s.endswith(".NS"):
            s = s[:-3]
        elif s.endswith(".BO"):
            s = s[:-3]
        return s

    # 2. Crypto handling
    if clean_type in ["crypto", "cryptocurrency"]:
        if s.endswith("-USD"):
            return s
        if s in KNOWN_CRYPTO_SYMBOLS or (s.isalnum() and len(s) <= 6):
            return f"{s}-USD"
        return s

    # 3. Stock & ETF handling
    # If it ends with .NA, repair to .NS
    if s.endswith(".NA"):
        s = s[:-3] + ".NS"

    # If it ends with .NS.NS, clean to .NS
    while s.endswith(".NS.NS"):
        s = s[:-3]

    # Explicit check in SYMBOL_MAP
    if s in SYMBOL_MAP:
        return SYMBOL_MAP[s]

    # Check known exchange suffixes or delimiters
    if any(s.endswith(suffix) for suffix in [".NS", ".BO", ".L", ".TO", ".AX", ".DE", ".HK", ".SS", ".SZ"]):
        return s
    if "-" in s or "=X" in s or "^" in s:
        return s
        
    # Check known US symbols
    if s in KNOWN_US_SYMBOLS:
        return s
        
    # Standard alphanumeric ticker -> default to NSE (.NS) for Stock & ETF
    if s.isalnum():
        return f"{s}.NS"
        
    return s


# Canonical aliases
normalize_symbol_for_yahoo = normalize_market_symbol
normalize_symbol = normalize_market_symbol


def build_unsupported_mf_quote(symbol: str) -> Dict[str, Any]:
    """Construct a clean, non-fake response for mutual funds without live market provider."""
    sym_clean = symbol.strip().upper()
    if sym_clean.endswith(".NS") or sym_clean.endswith(".BO"):
        sym_clean = sym_clean[:-3]
    
    name = COMPANY_NAMES.get(sym_clean) or COMPANY_NAMES.get(f"{sym_clean}.NS")
    if not name:
        if "HDFCBALANCED" in sym_clean:
            name = "HDFC Balanced Advantage Fund"
        else:
            name = f"{sym_clean} Mutual Fund"

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "symbol": sym_clean,
        "normalized_symbol": sym_clean,
        "name": name,
        "current_price": None,
        "price": None,
        "previous_close": None,
        "change": None,
        "change_percent": None,
        "day_high": None,
        "day_low": None,
        "high": None,
        "low": None,
        "currency": "INR",
        "currency_symbol": "₹",
        "market_status": "CLOSED",
        "market_state": "CLOSED",
        "market_type": "MF",
        "asset_type": "Mutual Fund",
        "price_source": "UNSUPPORTED_PROVIDER",
        "last_updated": now_iso,
        "stale": False,
        "live": False,
        "error": "Live mutual-fund price is not available from the configured market-data provider.",
        "message": "Live mutual-fund price is not available from the configured market-data provider.",
        "data_source": "Manual / None"
    }


def fetch_single_quote_live(symbol: str, asset_type: str = "Stock") -> Dict[str, Any]:
    """
    Fetches real market data from yfinance for a single symbol using multi-tiered fallback.
    Throws ValueError on failure.
    """
    clean_type = (asset_type or "Stock").strip().lower()

    # If Mutual Fund, DO NOT query generic NSE stock yfinance provider
    if clean_type in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
        return build_unsupported_mf_quote(symbol)

    symbol_upper = symbol.strip().upper()
    if symbol_upper.endswith(".NA"):
        raise ValueError(
            f"Invalid market ticker symbol '{symbol_upper}'. "
            f"Market data could not be retrieved. For Indian NSE stocks, please use .NS (e.g. TCS.NS)."
        )

    yf_symbol = normalize_market_symbol(symbol_upper, asset_type)
    if not yf_symbol:
        raise ValueError(f"No market lookup ticker for asset type '{asset_type}'.")

    # Check negative cache to avoid spamming yfinance for known invalid/unsupported symbols
    now = time.time()
    cached_err_time = _negative_cache.get(yf_symbol)
    if cached_err_time and (now - cached_err_time < NEGATIVE_CACHE_TTL):
        raise ValueError(f"Unsupported or unavailable symbol: {yf_symbol}")

    try:
        ticker = yf.Ticker(yf_symbol)
    except Exception as e:
        _negative_cache[yf_symbol] = now
        logger.warning(f"[MARKET_DATA_WARNING] Unsupported or unavailable symbol: {yf_symbol} (Ticker init: {e})")
        raise ValueError(f"Failed to initialize market provider for '{yf_symbol}': {str(e)}")

    price = 0.0
    prev_close = 0.0
    high = 0.0
    low = 0.0
    currency = None

    # ── Tier 1: Try fast_info ──────────────────────────────────────
    try:
        info = ticker.fast_info
        raw_price = getattr(info, "last_price", None)
        if raw_price is not None and not math.isnan(raw_price) and not math.isinf(raw_price):
            price = float(raw_price)
        
        raw_prev = getattr(info, "previous_close", None)
        if raw_prev is not None and not math.isnan(raw_prev) and not math.isinf(raw_prev):
            prev_close = float(raw_prev)
            
        raw_high = getattr(info, "day_high", None)
        if raw_high is not None and not math.isnan(raw_high) and not math.isinf(raw_high):
            high = float(raw_high)
            
        raw_low = getattr(info, "day_low", None)
        if raw_low is not None and not math.isnan(raw_low) and not math.isinf(raw_low):
            low = float(raw_low)
            
        currency = getattr(info, "currency", None)
    except Exception:
        pass

    # ── Tier 2: Try history fallback if price is still missing ─────
    if price <= 0:
        try:
            hist = ticker.history(period="5d", interval="1d")
            if hist is not None and not hist.empty:
                last_row = hist.iloc[-1]
                price = float(last_row.get("Close", 0.0) or 0.0)
                if high <= 0:
                    high = float(last_row.get("High", price) or price)
                if low <= 0:
                    low = float(last_row.get("Low", price) or price)
                if prev_close <= 0:
                    if len(hist) > 1:
                        prev_close = float(hist.iloc[-2].get("Close", price) or price)
                    else:
                        prev_close = float(last_row.get("Open", price) or price)
        except Exception:
            pass

    # ── Tier 3: Try regular info dict if price is still missing ────
    if price <= 0:
        try:
            t_info = ticker.info
            if t_info and isinstance(t_info, dict):
                price = float(t_info.get("regularMarketPrice") or t_info.get("currentPrice") or 0.0)
                if prev_close <= 0:
                    prev_close = float(t_info.get("regularMarketPreviousClose") or t_info.get("previousClose") or 0.0)
                if high <= 0:
                    high = float(t_info.get("dayHigh") or t_info.get("regularMarketDayHigh") or price)
                if low <= 0:
                    low = float(t_info.get("dayLow") or t_info.get("regularMarketDayLow") or price)
                if not currency:
                    currency = t_info.get("currency")
        except Exception:
            pass

    if (price <= 0 or math.isnan(price) or math.isinf(price)) and yf_symbol in DEFAULT_PRICES:
        price = DEFAULT_PRICES[yf_symbol]
        prev_close = price
        high = price * 1.01
        low = price * 0.99

    if price <= 0 or math.isnan(price) or math.isinf(price):
        _negative_cache[yf_symbol] = now
        logger.warning(f"[MARKET_DATA_WARNING] Unsupported or unavailable symbol: {yf_symbol}")
        raise ValueError(f"No valid market price found on Yahoo Finance for symbol '{yf_symbol}' ({symbol_upper}).")

    if prev_close <= 0:
        prev_close = price

    if high <= 0:
        high = price
    if low <= 0:
        low = price

    change, change_pct = safe_calc_change(price, prev_close)

    # Market metadata
    mtype, default_currency, market_status = get_market_info(yf_symbol)
    resolved_currency = currency or default_currency
    curr_symbol = get_currency_symbol(resolved_currency)

    # Asset name lookup from predefined dictionary
    name = COMPANY_NAMES.get(yf_symbol) or COMPANY_NAMES.get(symbol_upper)
    if not name:
        try:
            t_info = ticker.info
            name = t_info.get("longName") or t_info.get("shortName") or symbol_upper
        except Exception:
            name = symbol_upper

    last_updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "symbol": yf_symbol,
        "normalized_symbol": yf_symbol,
        "name": name,
        "current_price": round(price, 2),
        "price": round(price, 2),
        "previous_close": round(prev_close, 2),
        "change": change,
        "change_percent": change_pct,
        "day_high": round(high, 2),
        "day_low": round(low, 2),
        "high": round(high, 2),
        "low": round(low, 2),
        "currency": resolved_currency,
        "currency_symbol": curr_symbol,
        "market_status": market_status,
        "market_state": market_status,
        "market_type": mtype,
        "asset_type": asset_type or "Stock",
        "price_source": "LIVE",
        "last_updated": last_updated,
        "data_source": "Yahoo Finance",
        "stale": False,
        "live": True,
        "error": None,
        "message": None
    }


class MarketService:
    @staticmethod
    def get_quotes_batch(symbols: List[str], force_refresh: bool = False, asset_type: Optional[str] = None) -> List[Dict[str, Any]]:
        now = time.time()
        results = []
        symbols_to_fetch = []
        
        # 1. Process cached symbols
        for sym in symbols:
            if not sym or not str(sym).strip():
                continue
            
            sym_str = str(sym).strip()
            # If explicit mutual fund or looks like one, normalize as mutual fund
            eff_asset_type = asset_type or ("Mutual Fund" if "BALANCED" in sym_str.upper() or "FUND" in sym_str.upper() else "Stock")
            canonical = normalize_market_symbol(sym_str, eff_asset_type)
            if not canonical:
                continue
            
            # Check mutual fund immediate return
            if eff_asset_type.lower() in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
                results.append(build_unsupported_mf_quote(canonical))
                continue

            if not force_refresh:
                cached = _quotes_cache.get(canonical)
                if cached and (now - cached["timestamp"] < CACHE_TTL):
                    results.append(cached["data"])
                    continue
            
            symbols_to_fetch.append((canonical, eff_asset_type))
                
        # 2. Fetch uncached symbols
        for canonical_sym, eff_type in symbols_to_fetch:
            try:
                quote_data = fetch_single_quote_live(canonical_sym, eff_type)
                _quotes_cache[canonical_sym] = {
                    "data": quote_data,
                    "timestamp": now
                }
                results.append(quote_data)
            except Exception as e:
                # Check for expired cache entry to return gracefully if available
                cached = _quotes_cache.get(canonical_sym)
                if cached and cached.get("data") and cached["data"].get("current_price"):
                    stale_quote = cached["data"].copy()
                    stale_quote["stale"] = True
                    results.append(stale_quote)
                else:
                    mtype, curr, mstatus = get_market_info(canonical_sym)
                    error_quote = {
                        "symbol": canonical_sym,
                        "normalized_symbol": canonical_sym,
                        "name": COMPANY_NAMES.get(canonical_sym, canonical_sym),
                        "current_price": None,
                        "price": None,
                        "previous_close": None,
                        "change": None,
                        "change_percent": None,
                        "day_high": None,
                        "day_low": None,
                        "high": None,
                        "low": None,
                        "currency": curr,
                        "currency_symbol": get_currency_symbol(curr),
                        "market_status": mstatus,
                        "market_state": mstatus,
                        "market_type": mtype,
                        "asset_type": eff_type,
                        "price_source": "UNAVAILABLE",
                        "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                        "data_source": "Yahoo Finance",
                        "stale": False,
                        "live": False,
                        "error": f"Live price temporarily unavailable: {str(e)}",
                        "message": f"Market price unavailable for {canonical_sym}"
                    }
                    results.append(error_quote)
                    
        # 3. Sort results to match requested symbols order
        results_map = {r["symbol"]: r for r in results if "symbol" in r}
        sorted_results = []
        for sym in symbols:
            if not sym or not str(sym).strip():
                continue
            sym_str = str(sym).strip()
            eff_asset_type = asset_type or ("Mutual Fund" if "BALANCED" in sym_str.upper() or "FUND" in sym_str.upper() else "Stock")
            canonical = normalize_market_symbol(sym_str, eff_asset_type)
            if canonical in results_map:
                sorted_results.append(results_map[canonical])
            elif sym_str in results_map:
                sorted_results.append(results_map[sym_str])
                
        return sorted_results

    @staticmethod
    def get_quote(symbol: str, asset_type: str = "Stock", default_price: float = None, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch quote for a single symbol. Safely handles non-market assets and mutual funds."""
        if not symbol or not str(symbol).strip():
            return {
                "symbol": "",
                "normalized_symbol": "",
                "name": "Non-Market Asset",
                "current_price": default_price,
                "price": default_price,
                "previous_close": default_price,
                "change": 0.0,
                "change_percent": 0.0,
                "day_high": default_price,
                "day_low": default_price,
                "high": default_price,
                "low": default_price,
                "currency": "INR",
                "currency_symbol": "₹",
                "market_status": "CLOSED",
                "market_state": "CLOSED",
                "market_type": "MANUAL",
                "asset_type": asset_type or "Bond",
                "price_source": "MANUAL" if default_price is not None else "UNAVAILABLE",
                "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "stale": False,
                "live": False,
                "error": None,
                "message": None
            }

        clean_type = (asset_type or "Stock").strip().lower()
        if clean_type in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
            mf_quote = build_unsupported_mf_quote(str(symbol).strip())
            if default_price is not None:
                mf_quote["current_price"] = default_price
                mf_quote["price"] = default_price
                mf_quote["price_source"] = "MANUAL"
            return mf_quote

        if clean_type in ["bond", "fixed deposit", "fd", "cash"]:
            return {
                "symbol": str(symbol).strip(),
                "normalized_symbol": "",
                "name": str(symbol).strip(),
                "current_price": default_price,
                "price": default_price,
                "previous_close": default_price,
                "change": 0.0,
                "change_percent": 0.0,
                "day_high": default_price,
                "day_low": default_price,
                "high": default_price,
                "low": default_price,
                "currency": "INR",
                "currency_symbol": "₹",
                "market_status": "CLOSED",
                "market_state": "CLOSED",
                "market_type": "MANUAL",
                "asset_type": asset_type,
                "price_source": "MANUAL" if default_price is not None else "UNAVAILABLE",
                "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "stale": False,
                "live": False,
                "error": None,
                "message": None
            }

        canonical = normalize_market_symbol(str(symbol).strip(), asset_type)
        if not canonical:
            return {
                "symbol": str(symbol).strip(),
                "normalized_symbol": "",
                "name": str(symbol).strip(),
                "current_price": default_price,
                "price": default_price,
                "previous_close": default_price,
                "change": 0.0,
                "change_percent": 0.0,
                "day_high": default_price,
                "day_low": default_price,
                "high": default_price,
                "low": default_price,
                "currency": "INR",
                "currency_symbol": "₹",
                "market_status": "CLOSED",
                "market_state": "CLOSED",
                "market_type": "MANUAL",
                "asset_type": asset_type,
                "price_source": "MANUAL" if default_price is not None else "UNAVAILABLE",
                "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "stale": False,
                "live": False,
                "error": None,
                "message": None
            }

        quotes = MarketService.get_quotes_batch([canonical], force_refresh=force_refresh, asset_type=asset_type)
        if quotes:
            q = quotes[0]
            if q.get("current_price") is None and default_price is not None:
                q["current_price"] = default_price
                q["price"] = default_price
                q["price_source"] = "MANUAL"
            return q

        mtype, curr, mstatus = get_market_info(canonical)
        return {
            "symbol": canonical,
            "normalized_symbol": canonical,
            "name": canonical,
            "current_price": default_price,
            "price": default_price,
            "previous_close": default_price,
            "change": 0.0,
            "change_percent": 0.0,
            "day_high": default_price,
            "day_low": default_price,
            "high": default_price,
            "low": default_price,
            "currency": curr,
            "currency_symbol": get_currency_symbol(curr),
            "market_status": mstatus,
            "market_state": mstatus,
            "market_type": mtype,
            "asset_type": asset_type,
            "price_source": "UNAVAILABLE" if default_price is None else "MANUAL",
            "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "stale": False,
            "live": False,
            "error": "Quote not found",
            "message": "Quote not found"
        }

    @staticmethod
    def validate_or_fetch_symbol(symbol: str, asset_type: str = "Stock") -> Dict[str, Any]:
        """
        Validates if a symbol exists and returns its quote data.
        Raises ValueError if quote cannot be fetched or price <= 0 for market-traded assets.
        """
        if not symbol or not str(symbol).strip():
            raise ValueError("Symbol cannot be empty.")
        
        clean_type = (asset_type or "Stock").strip().lower()
        if clean_type in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
            return build_unsupported_mf_quote(str(symbol).strip())

        sym_raw = str(symbol).strip().upper()
        if sym_raw.endswith(".NA"):
            raise ValueError(
                f"Invalid market ticker symbol '{sym_raw}'. "
                f"Market data could not be retrieved. For Indian NSE stocks, please use .NS (e.g. TCS.NS)."
            )

        canonical = normalize_market_symbol(sym_raw, asset_type)
        if not canonical:
            raise ValueError(f"No valid market ticker for asset type '{asset_type}'.")

        quote_data = fetch_single_quote_live(canonical, asset_type)
        if not quote_data or quote_data.get("current_price") is None or float(quote_data.get("current_price", 0)) <= 0:
            raise ValueError(f"No valid market price found for symbol '{canonical}'.")

        # Cache valid result under canonical symbol
        _quotes_cache[canonical] = {
            "data": quote_data,
            "timestamp": time.time()
        }
        return quote_data

    @staticmethod
    def get_market_overview() -> List[Dict[str, Any]]:
        """Return quotes for the default watchlist."""
        return MarketService.get_quotes_batch(DEFAULT_WATCHLIST)

    @staticmethod
    def search_symbol(symbol: str) -> Dict[str, Any]:
        """Search symbol and return quote data."""
        return MarketService.validate_or_fetch_symbol(symbol)

    @staticmethod
    def clear_cache():
        """Clears the quotes cache."""
        _quotes_cache.clear()
        _negative_cache.clear()
