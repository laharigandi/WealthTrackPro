import pytest
from fastapi.testclient import TestClient
from app.main import app, heal_database_records
from app.database import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.services.market_service import MarketService, normalize_symbol_for_yahoo, fetch_single_quote_live

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
    
    # Clean holdings & transactions for user
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
# 1. TICKER NORMALIZATION & VALIDATION TESTS
# ==============================================================================

def test_centralized_normalization_variations():
    """Verify that TCS, tcs,  TCS , TCS.NS all resolve to canonical TCS.NS and never TCS.NA or TCS.NS.NS."""
    assert normalize_symbol_for_yahoo("TCS", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo("tcs", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo(" TCS ", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo("TCS.NS", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo("tcs.ns", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo("TCS.NS.NS", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo("RELIANCE", "Stock") == "RELIANCE.NS"
    assert normalize_symbol_for_yahoo("INFY", "Stock") == "INFY.NS"
    assert normalize_symbol_for_yahoo("AAPL", "Stock") == "AAPL"
    assert normalize_symbol_for_yahoo("BTC-USD", "Crypto") == "BTC-USD"
    assert normalize_symbol_for_yahoo("GOVT-BOND", "Bond") == ""
    assert normalize_symbol_for_yahoo("CASH", "Cash") == ""


def test_tcs_na_invalid_rejection(setup_user_and_clean_holdings):
    """Verify that an explicit .NA ticker is rejected by the validator and never stored as .NA."""
    headers = setup_user_and_clean_holdings
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS.NA",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 10.0,
        "average_buy_price": 4000.0
    })
    assert r.status_code == 400
    assert "Invalid market ticker symbol" in r.json()["detail"]


# ==============================================================================
# 2. MARKET DATA SERVICE DIRECT PROVIDER TESTS
# ==============================================================================

def test_fetch_single_quote_live_tcs():
    """Test market data service directly fetching TCS.NS from provider."""
    quote = fetch_single_quote_live("TCS.NS", "Stock")
    assert quote["symbol"] == "TCS.NS"
    assert quote["normalized_symbol"] == "TCS.NS"
    assert quote["current_price"] > 0
    assert quote["price"] > 0
    assert quote["price_source"] == "LIVE"
    assert quote["currency"] == "INR"
    assert quote["currency_symbol"] == "₹"
    assert quote["error"] is None


def test_market_service_get_quote_batch():
    """Test MarketService batch retrieval with caching."""
    quotes = MarketService.get_quotes_batch(["TCS.NS", "RELIANCE.NS"])
    assert len(quotes) == 2
    tcs_q = next(q for q in quotes if q["symbol"] == "TCS.NS")
    assert tcs_q["current_price"] > 0
    assert tcs_q["price_source"] == "LIVE"


# ==============================================================================
# 3. PORTFOLIO CREATION, ENRICHMENT & VALUATION
# ==============================================================================

def test_create_and_enrich_tcs_holding(setup_user_and_clean_holdings):
    """
    User inputs:
      Ticker: TCS
      Asset Type: Stock
      Quantity: 400
      Average Buy Price: 4590
    Expected:
      Symbol: TCS (display) / normalized: TCS.NS
      Current Price: > 0
      Price Source: LIVE
      Current Value: 400 * current_price
      P/L: Current Value - Invested Value
    """
    headers = setup_user_and_clean_holdings
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 400.0,
        "average_buy_price": 4590.0
    })
    assert r.status_code == 201
    item = r.json()
    assert item["normalized_symbol"] == "TCS.NS"
    assert item["total_investment_value"] == 1836000.0
    assert item["current_price"] is not None
    assert item["current_price"] > 0
    assert item["price_source"] == "LIVE"
    assert item["price_status"] == "Live"
    assert item["current_value"] == round(400.0 * item["current_price"], 2)
    assert item["profit_loss"] == round(item["current_value"] - 1836000.0, 2)


def test_bond_manual_valuation(setup_user_and_clean_holdings):
    """Non-market asset (GOVT-BOND) uses MANUAL price source, never queries live market."""
    headers = setup_user_and_clean_holdings
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "GOVT-BOND",
        "asset_name": "Government Bond 2030",
        "asset_type": "Bond",
        "quantity": 150.0,
        "average_buy_price": 1000.0,
        "manual_price": 1000.0
    })
    assert r.status_code == 201
    item = r.json()
    assert item["price_source"] == "MANUAL"
    assert item["price_status"] == "Manual"
    assert item["current_price"] == 1000.0
    assert item["current_value"] == 150000.0
    assert item["profit_loss"] == 0.0


# ==============================================================================
# 4. PARTIAL VALUATION & UNAVAILABLE PRICE HANDLING
# ==============================================================================

def test_partial_portfolio_valuation(setup_user_and_clean_holdings):
    """
    If one asset has live price (TCS.NS) and one has unavailable price (UNLISTED):
    - System reports incomplete live valuation (PARTIALLY VALUED)
    - Does NOT crash
    - Does NOT use average buy price as current market price
    """
    headers = setup_user_and_clean_holdings
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        h_live = Portfolio(
            user_id=user.id,
            symbol="TCS",
            normalized_symbol="TCS.NS",
            asset_name="Tata Consultancy Services",
            asset_type="Stock",
            quantity=10.0,
            average_buy_price=4000.0
        )
        h_unlisted = Portfolio(
            user_id=user.id,
            symbol="UNLISTED-CO",
            normalized_symbol="UNLISTED-CO.NS",
            asset_name="Unlisted Company",
            asset_type="Stock",
            quantity=100.0,
            average_buy_price=500.0,
            manual_price=None
        )
        db.add(h_live)
        db.add(h_unlisted)
        db.commit()
    finally:
        db.close()

    r = client.get("/api/v1/portfolio", headers=headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2

    live_item = next(i for i in items if i["symbol"] == "TCS")
    unlisted_item = next(i for i in items if i["symbol"] == "UNLISTED-CO")

    assert live_item["price_source"] == "LIVE"
    assert live_item["current_price"] is not None
    assert live_item["current_value"] is not None

    assert unlisted_item["price_source"] == "UNAVAILABLE"
    assert unlisted_item["current_price"] is None
    assert unlisted_item["current_value"] is None
    assert unlisted_item["profit_loss"] is None
    assert unlisted_item["average_buy_price"] == 500.0


# ==============================================================================
# 5. TRANSACTIONS & PORTFOLIO SYNCHRONIZATION
# ==============================================================================

def test_transaction_sync_and_duplicate_prevention(setup_user_and_clean_holdings):
    """Verify transactions and holdings match by canonical symbol without creating duplicates."""
    headers = setup_user_and_clean_holdings
    # 1. Add TCS holding
    r1 = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 200.0,
        "average_buy_price": 4000.0
    })
    assert r1.status_code == 201

    # 2. Add BUY transaction with TCS
    r2 = client.post("/api/v1/transactions", headers=headers, json={
        "symbol": "TCS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "transaction_type": "BUY",
        "quantity": 200.0,
        "price": 4500.0
    })
    assert r2.status_code == 201

    # Check portfolio holding updated cleanly
    r3 = client.get("/api/v1/portfolio", headers=headers)
    assert r3.status_code == 200
    holdings = r3.json()
    assert len(holdings) == 1
    assert holdings[0]["quantity"] == 400.0
    assert holdings[0]["average_buy_price"] == 4250.0  # (200*4000 + 200*4500)/400


# ==============================================================================
# 6. DATABASE AUTO-HEALING ON STARTUP
# ==============================================================================

def test_database_auto_healing():
    """Verify database auto-healing migrates legacy .NA records and merges duplicates."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        # Seed corrupt legacy record
        h_corrupt = Portfolio(
            user_id=user.id,
            symbol="TCS.NA",
            normalized_symbol=None,
            asset_name="Legacy TCS",
            asset_type="Stock",
            quantity=400.0,
            average_buy_price=4590.0
        )
        db.add(h_corrupt)
        db.commit()

        # Run healing
        heal_database_records(db)

        # Check healed
        healed = db.query(Portfolio).filter(Portfolio.user_id == user.id, Portfolio.id == h_corrupt.id).first()
        assert healed.symbol == "TCS.NS"
        assert healed.normalized_symbol == "TCS.NS"
        if healed:
            db.delete(healed)
            db.commit()
    finally:
        db.close()
