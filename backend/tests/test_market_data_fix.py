import pytest
from fastapi.testclient import TestClient
from app.main import app, heal_database_records
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.services.market_service import (
    MarketService,
    normalize_market_symbol,
    normalize_symbol_for_yahoo,
    fetch_single_quote_live,
    _negative_cache,
)

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def setup_user_and_clean_holdings():
    # Login demo user
    r = client.post("/api/v1/auth/login", json={
        "email": "john@example.com",
        "password": "password123"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Clean holdings & transactions for demo user
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.commit()
    finally:
        db.close()
        
    yield headers

    # Teardown: Clean holdings & transactions for demo user
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.commit()
    finally:
        db.close()


# ==============================================================================
# 1. SYMBOL NORMALIZATION UNIT TESTS
# ==============================================================================

def test_symbol_normalization_rules():
    """Verify symbol normalization handles stocks, US tickers, crypto, mutual funds, and non-market assets."""
    # Stocks & ETFs
    assert normalize_market_symbol("TCS", "Stock") == "TCS.NS"
    assert normalize_market_symbol("TCS.NS", "Stock") == "TCS.NS"
    assert normalize_market_symbol("INFY", "Stock") == "INFY.NS"
    assert normalize_market_symbol("RELIANCE", "Stock") == "RELIANCE.NS"
    assert normalize_market_symbol("HDFCBANK", "Stock") == "HDFCBANK.NS"
    assert normalize_market_symbol("NIFTYBEES", "ETF") == "NIFTYBEES.NS"
    assert normalize_market_symbol("AAPL", "Stock") == "AAPL"
    assert normalize_market_symbol("MSFT", "Stock") == "MSFT"

    # Crypto
    assert normalize_market_symbol("BTC", "Crypto") == "BTC-USD"
    assert normalize_market_symbol("ETH", "Crypto") == "ETH-USD"
    assert normalize_market_symbol("BTC-USD", "Crypto") == "BTC-USD"

    # Mutual Fund - MUST NOT APPEND .NS
    assert normalize_market_symbol("HDFCBALANCED", "Mutual Fund") == "HDFCBALANCED"
    assert normalize_market_symbol("HDFCBALANCED.NS", "Mutual Fund") == "HDFCBALANCED"
    assert normalize_market_symbol("NIPPONGROWTH", "Mutual Fund") == "NIPPONGROWTH"

    # Bond & Cash
    assert normalize_market_symbol("GOVT-BOND", "Bond") == ""
    assert normalize_market_symbol("CASH", "Cash") == ""


# ==============================================================================
# 2. MUTUAL FUND & LIVE PROVIDER TESTS
# ==============================================================================

def test_hdfc_balanced_mutual_fund_quote():
    """Verify HDFCBALANCED as Mutual Fund never queries yfinance stock path and returns clean unsupported status."""
    quote = MarketService.get_quote("HDFCBALANCED", asset_type="Mutual Fund")
    assert quote["symbol"] == "HDFCBALANCED"
    assert quote["current_price"] is None
    assert quote["live"] is False
    assert quote["price_source"] == "UNSUPPORTED_PROVIDER"
    assert "Live mutual-fund price is not available" in quote["error"]


def test_hdfc_balanced_with_manual_price():
    """Verify Mutual Fund with manual price override returns manual valuation."""
    quote = MarketService.get_quote("HDFCBALANCED", asset_type="Mutual Fund", default_price=450.0)
    assert quote["symbol"] == "HDFCBALANCED"
    assert quote["current_price"] == 450.0
    assert quote["price_source"] == "MANUAL"


# ==============================================================================
# 3. LIVE STOCKS & CRYPTO PROVIDER TESTS
# ==============================================================================

def test_fetch_live_stocks_and_crypto():
    """Verify TCS, INFY, RELIANCE, HDFCBANK, AAPL, BTC-USD can fetch valid live quotes."""
    for sym in ["TCS.NS", "INFY.NS", "RELIANCE.NS", "HDFCBANK.NS", "AAPL", "BTC-USD"]:
        quote = MarketService.get_quote(sym)
        assert quote["symbol"] == sym
        assert quote["current_price"] is not None
        assert quote["current_price"] > 0
        assert quote["price_source"] == "LIVE"


# ==============================================================================
# 4. INVALID SYMBOLS & BATCH ISOLATION TESTS
# ==============================================================================

def test_invalid_symbol_isolation_in_batch():
    """
    Verify querying an invalid symbol (e.g. INVALIDXYZ999) does NOT crash
    and does NOT prevent valid symbols from returning live prices.
    """
    batch_symbols = ["TCS.NS", "INVALIDXYZ999", "INFY.NS"]
    quotes = MarketService.get_quotes_batch(batch_symbols)
    
    assert len(quotes) == 3
    q_map = {q["symbol"]: q for q in quotes}

    # Valid TCS.NS
    assert "TCS.NS" in q_map
    assert q_map["TCS.NS"]["current_price"] is not None
    assert q_map["TCS.NS"]["price_source"] == "LIVE"

    # Valid INFY.NS
    assert "INFY.NS" in q_map
    assert q_map["INFY.NS"]["current_price"] is not None
    assert q_map["INFY.NS"]["price_source"] == "LIVE"

    # Invalid symbol
    assert "INVALIDXYZ999.NS" in q_map or "INVALIDXYZ999" in q_map
    inv_key = "INVALIDXYZ999.NS" if "INVALIDXYZ999.NS" in q_map else "INVALIDXYZ999"
    assert q_map[inv_key]["current_price"] is None
    assert q_map[inv_key]["price_source"] == "UNAVAILABLE"


# ==============================================================================
# 5. DATABASE AUTO-HEALING TESTS
# ==============================================================================

def test_auto_heal_hdfcbalanced_records():
    """Verify database auto-healing fixes any corrupted HDFCBALANCED.NS holding to Mutual Fund / HDFCBALANCED."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        
        # Insert a corrupt holding with .NS and Stock
        corrupt_h = Portfolio(
            user_id=user.id,
            symbol="HDFCBALANCED.NS",
            normalized_symbol="HDFCBALANCED.NS",
            asset_name="HDFC Balanced Advantage Fund",
            asset_type="Stock",
            quantity=100.0,
            average_buy_price=350.0
        )
        db.add(corrupt_h)
        db.commit()

        # Run healing
        heal_database_records(db)

        # Verify healed
        healed = db.query(Portfolio).filter(Portfolio.id == corrupt_h.id).first()
        assert healed.asset_type == "Mutual Fund"
        assert healed.symbol == "HDFCBALANCED"
        assert healed.normalized_symbol == "HDFCBALANCED"

        # Cleanup
        db.delete(healed)
        db.commit()
    finally:
        db.close()


# ==============================================================================
# 6. PORTFOLIO API ENDPOINT WITH MUTUAL FUNDS
# ==============================================================================

def test_portfolio_api_with_mutual_fund(setup_user_and_clean_holdings):
    """Verify creating and fetching a Mutual Fund holding via Portfolio API works cleanly."""
    headers = setup_user_and_clean_holdings
    
    # Create Mutual Fund holding
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "HDFCBALANCED",
        "asset_name": "HDFC Balanced Advantage Fund",
        "asset_type": "Mutual Fund",
        "quantity": 100.0,
        "average_buy_price": 350.0
    })
    assert r.status_code == 201
    item = r.json()
    assert item["symbol"] == "HDFCBALANCED"
    assert item["asset_type"] == "Mutual Fund"
    assert item["current_price"] is None
    assert item["price_source"] == "UNAVAILABLE"
    assert item["price_status"] == "Live unavailable"

    # Fetch portfolio
    r_get = client.get("/api/v1/portfolio", headers=headers)
    assert r_get.status_code == 200
    items = r_get.json()
    assert len(items) == 1
    assert items[0]["symbol"] == "HDFCBALANCED"
    assert items[0]["asset_type"] == "Mutual Fund"
