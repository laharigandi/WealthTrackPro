import time
import logging
from typing import Dict, Any, List
import yfinance as yf

logger = logging.getLogger(__name__)

# Global in-memory cache: {symbol_upper: {"data": quote_dict, "timestamp": float}}
_quotes_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 30

SYMBOL_MAP: Dict[str, str] = {
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "INFY": "INFY.NS",
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

def fetch_single_quote_live(symbol: str) -> Dict[str, Any]:
    """
    Fetches real market data from yfinance for a single symbol.
    Throws Exception on failure.
    """
    symbol_upper = symbol.strip().upper()
    yf_symbol = SYMBOL_MAP.get(symbol_upper, symbol_upper)
    ticker = yf.Ticker(yf_symbol)
    
    # Try fetching fast_info
    info = ticker.fast_info
    price = float(getattr(info, "last_price", None) or 0)
    prev_close = float(getattr(info, "previous_close", None) or 0)
    
    if price <= 0:
        # Fallback: check if we can get price from regular info dict
        try:
            t_info = ticker.info
            price = float(t_info.get("regularMarketPrice", None) or 0)
            prev_close = float(t_info.get("regularMarketPreviousClose", None) or t_info.get("previousClose", None) or 0)
        except Exception:
            pass

    if price <= 0:
        raise ValueError(f"No valid price found for symbol {symbol_upper}")

    change = round(price - prev_close, 2)
    change_pct = round((change / prev_close * 100) if prev_close else 0.0, 2)
    
    # Get currency
    currency = getattr(info, "currency", None) or "USD"
    # Try fetching name
    name = None
    try:
        t_info = ticker.info
        name = t_info.get("longName") or t_info.get("shortName")
        currency = t_info.get("currency") or currency
    except Exception:
        pass

    # Try fetching market_state
    market_state = None
    try:
        market_state = ticker.info.get("marketState")
    except Exception:
        pass

    # Determine asset_type based on yfinance info or default to Stock
    asset_type = "Stock"
    try:
        quote_type = getattr(info, "quote_type", "EQUITY").upper()
        asset_type_map = {
            "EQUITY": "Stock",
            "ETF": "ETF",
            "MUTUALFUND": "Mutual Fund",
            "CRYPTOCURRENCY": "Crypto",
            "BOND": "Bond",
        }
        asset_type = asset_type_map.get(quote_type, "Stock")
    except Exception:
        pass

    return {
        "symbol": symbol_upper,
        "name": name,
        "price": price,
        "previous_close": prev_close,
        "change": change,
        "change_percent": change_pct,
        "day_high": round(float(getattr(info, "day_high", price) or price), 2),
        "day_low": round(float(getattr(info, "day_low", price) or price), 2),
        "currency": currency,
        "currency_symbol": get_currency_symbol(currency),
        "market_state": market_state or "REGULAR",
        "asset_type": asset_type,
        "stale": False,
        "error": None
    }


class MarketService:
    @staticmethod
    def get_quotes_batch(symbols: List[str]) -> List[Dict[str, Any]]:
        now = time.time()
        results = []
        symbols_to_fetch = []
        
        # 1. Process cached symbols
        for sym in symbols:
            sym_upper = sym.strip().upper()
            if not sym_upper:
                continue
            
            cached = _quotes_cache.get(sym_upper)
            if cached and (now - cached["timestamp"] < CACHE_TTL):
                # Valid cache hit
                results.append(cached["data"])
            else:
                symbols_to_fetch.append(sym_upper)
                
        # 2. Fetch uncached symbols
        for sym_upper in symbols_to_fetch:
            try:
                # Fetch live data
                quote_data = fetch_single_quote_live(sym_upper)
                # Store in cache
                _quotes_cache[sym_upper] = {
                    "data": quote_data,
                    "timestamp": now
                }
                results.append(quote_data)
            except Exception as e:
                logger.error(f"Error fetching live quote for {sym_upper}: {str(e)}")
                # Check if we have an expired/stale cache entry we can return
                cached = _quotes_cache.get(sym_upper)
                if cached:
                    stale_quote = cached["data"].copy()
                    stale_quote["stale"] = True
                    results.append(stale_quote)
                else:
                    # Return error quote
                    error_quote = {
                        "symbol": sym_upper,
                        "name": None,
                        "price": None,
                        "previous_close": None,
                        "change": None,
                        "change_percent": None,
                        "day_high": None,
                        "day_low": None,
                        "currency": None,
                        "currency_symbol": None,
                        "market_state": None,
                        "asset_type": "Stock",
                        "stale": False,
                        "error": f"Failed to fetch market data: {str(e)}"
                    }
                    results.append(error_quote)
                    
        # 3. Sort results to match the original symbols request order
        results_map = {r["symbol"]: r for r in results}
        sorted_results = []
        for sym in symbols:
            sym_upper = sym.strip().upper()
            if sym_upper in results_map:
                sorted_results.append(results_map[sym_upper])
                
        return sorted_results

    @staticmethod
    def get_quote(symbol: str) -> Dict[str, Any]:
        """Fetch quote for a single symbol (reuses batch method)."""
        quotes = MarketService.get_quotes_batch([symbol])
        if quotes:
            return quotes[0]
        raise ValueError(f"Failed to fetch quote for symbol {symbol}")

    @staticmethod
    def get_market_overview() -> List[Dict[str, Any]]:
        """Return quotes for the default watchlist."""
        return MarketService.get_quotes_batch(DEFAULT_WATCHLIST)

    @staticmethod
    def search_symbol(symbol: str) -> Dict[str, Any]:
        """Search symbol (reuses get_quote)."""
        return MarketService.get_quote(symbol)
