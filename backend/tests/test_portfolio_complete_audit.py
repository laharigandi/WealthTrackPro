import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.portfolio import Portfolio
from app.models.user import User
from app.services.market_service import normalize_symbol_for_yahoo
from app.api.v1.advisor import _portfolio_risk_level, _generate_recommendations, TARGET_ALLOCATIONS

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
    
    # Set risk profile to Moderate
    r_risk = client.patch("/api/v1/users/me/risk-profile", headers=headers, json={"risk_profile": "moderate"})
    assert r_risk.status_code == 200
    
    # Clean holdings
    db = SessionLocal()
    try:
        from app.models.transaction import Transaction
        user = db.query(User).filter(User.email == "john@example.com").first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.commit()
    finally:
        db.close()
        
    yield headers

    # Teardown: Clean holdings & transactions
    db = SessionLocal()
    try:
        from app.models.transaction import Transaction
        user = db.query(User).filter(User.email == "john@example.com").first()
        if user:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
            db.commit()
    finally:
        db.close()


# ==============================================================================
# SECTION 18 REGRESSION TESTS (TEST 1 to TEST 8)
# ==============================================================================

def test_regression_test_1_tcs_normalization(setup_user_and_clean_holdings):
    """TEST 1: Input: TCS -> Expected normalized symbol: TCS.NS"""
    headers = setup_user_and_clean_holdings
    
    # Unit normalization check
    assert normalize_symbol_for_yahoo("TCS", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo("RELIANCE", "Stock") == "RELIANCE.NS"
    assert normalize_symbol_for_yahoo("INFY", "Stock") == "INFY.NS"
    assert normalize_symbol_for_yahoo("HDFCBANK", "Stock") == "HDFCBANK.NS"
    assert normalize_symbol_for_yahoo("AAPL", "Stock") == "AAPL"
    assert normalize_symbol_for_yahoo("MSFT", "Stock") == "MSFT"
    assert normalize_symbol_for_yahoo("TSLA", "Stock") == "TSLA"
    assert normalize_symbol_for_yahoo("BTC-USD", "Crypto") == "BTC-USD"
    
    # API creation check
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 400.0,
        "average_buy_price": 4590.0
    })
    assert r.status_code == 201
    item = r.json()
    assert item["symbol"] == "TCS"
    assert item["normalized_symbol"] == "TCS.NS"
    assert item["normalized_symbol"] != "TCS.NA"


def test_regression_test_2_valid_live_stock_price(setup_user_and_clean_holdings):
    """TEST 2: Valid live stock price available -> Price Source = LIVE, Current Value calculated, P/L calculated."""
    headers = setup_user_and_clean_holdings
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS.NS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 10.0,
        "average_buy_price": 3000.0
    })
    assert r.status_code == 201
    item = r.json()
    if item["current_price"] is not None:
        assert item["price_source"] == "LIVE"
        assert item["current_value"] == item["quantity"] * item["current_price"]
        assert item["profit_loss"] == item["current_value"] - item["total_investment_value"]


def test_regression_test_3_live_stock_price_unavailable(setup_user_and_clean_holdings):
    """TEST 3: Live stock price unavailable -> Current Price = None (—), Price Source = UNAVAILABLE, Current Value = None, P/L = None, Avg Buy Price unchanged."""
    headers = setup_user_and_clean_holdings
    # Directly insert unlisted stock without manual price in DB to simulate unavailable market quote
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        h = Portfolio(
            user_id=user.id,
            symbol="UNLISTED-STOCK",
            normalized_symbol="UNLISTED-STOCK.NS",
            asset_name="Unlisted Tech Startup",
            asset_type="Stock",
            quantity=400.0,
            average_buy_price=4590.0,
            manual_price=None
        )
        db.add(h)
        db.commit()
    finally:
        db.close()

    r = client.get("/api/v1/portfolio", headers=headers)
    assert r.status_code == 200
    items = r.json()
    h_res = next(i for i in items if i["symbol"] == "UNLISTED-STOCK")
    assert h_res["current_price"] is None
    assert h_res["current_value"] is None
    assert h_res["profit_loss"] is None
    assert h_res["profit_loss_percentage"] is None
    assert h_res["price_source"] == "UNAVAILABLE"
    assert h_res["average_buy_price"] == 4590.0
    assert h_res["total_investment_value"] == 1836000.0


def test_regression_test_4_tcs_and_govt_bond_invested_fallback(setup_user_and_clean_holdings):
    """TEST 4: TCS + Government Bond -> Expected invested allocation: Stock ≈ 92.45%, Bond ≈ 7.55% when using invested fallback."""
    headers = setup_user_and_clean_holdings
    # Add TCS (400 @ 4590 = 18,36,000) and Bond (150 @ 1000 = 1,50,000 with manual price 1000)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        h_tcs = Portfolio(
            user_id=user.id,
            symbol="TCS",
            normalized_symbol="TCS.NS",
            asset_name="Tata Consultancy Services",
            asset_type="Stock",
            quantity=400.0,
            average_buy_price=4590.0
        )
        h_bond = Portfolio(
            user_id=user.id,
            symbol="GOVT-BOND",
            normalized_symbol="",
            asset_name="Government Bond",
            asset_type="Bond",
            quantity=150.0,
            average_buy_price=1000.0,
            manual_price=1000.0
        )
        db.add(h_tcs)
        db.add(h_bond)
        db.commit()
    finally:
        db.close()

    r = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r.status_code == 200
    adv = r.json()
    assert adv["total_invested_value"] == 1986000.0
    
    # Check allocation summary
    stock_alloc = next(a for a in adv["allocation_summary"] if a["asset_type"] == "Stock")
    bond_alloc = next(a for a in adv["allocation_summary"] if a["asset_type"] == "Bond")
    
    # If fallback is active due to mock/offline quote or live prices
    if adv["is_fallback"]:
        assert abs(stock_alloc["current_pct"] - 92.45) < 0.1
        assert abs(bond_alloc["current_pct"] - 7.55) < 0.1


def test_regression_test_5_moderate_risk_benchmark():
    """TEST 5: Moderate risk profile target: Stock 40%, ETF 25%, Bond 25%, Cash 10% (Sum = 100%)."""
    mod_target = TARGET_ALLOCATIONS["moderate"]
    assert mod_target["Stock"] == 40.0
    assert mod_target["ETF"] == 25.0
    assert mod_target["Bond"] == 25.0
    assert mod_target["Cash"] == 10.0
    assert sum(mod_target.values()) == 100.0


def test_regression_test_6_high_stock_allocation_not_conservative():
    """TEST 6: High stock allocation (92.45%) -> Portfolio Risk != Conservative (it is Aggressive), Rebalancing Recommended."""
    allocs = {"Stock": 92.45, "Bond": 7.55, "ETF": 0.0, "Cash": 0.0}
    risk = _portfolio_risk_level(allocs)
    assert risk == "aggressive"
    assert risk != "conservative"

    recs = _generate_recommendations("moderate", allocs, TARGET_ALLOCATIONS["moderate"])
    assert len(recs) > 0
    stock_rec = next(r for r in recs if r["asset_type"] == "Stock")
    assert stock_rec["status"] == "OVERWEIGHT"
    assert stock_rec["action"] == "reduce"


def test_regression_test_7_all_holdings_live_prices(setup_user_and_clean_holdings):
    """TEST 7: All holdings have live/valid prices -> Allocation uses current market values."""
    headers = setup_user_and_clean_holdings
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        h1 = Portfolio(
            user_id=user.id,
            symbol="STOCK-A",
            normalized_symbol="",
            asset_name="Stock A",
            asset_type="Stock",
            quantity=10.0,
            average_buy_price=100.0,
            manual_price=200.0  # current value = 2000
        )
        h2 = Portfolio(
            user_id=user.id,
            symbol="BOND-B",
            normalized_symbol="",
            asset_name="Bond B",
            asset_type="Bond",
            quantity=10.0,
            average_buy_price=100.0,
            manual_price=100.0  # current value = 1000
        )
        db.add(h1)
        db.add(h2)
        db.commit()
    finally:
        db.close()

    r = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r.status_code == 200
    adv = r.json()
    assert adv["is_fallback"] is False
    assert adv["valuation_basis"] == "Live Market Value"
    assert adv["total_portfolio_value"] == 3000.0  # 2000 + 1000
    stock_alloc = next(a for a in adv["allocation_summary"] if a["asset_type"] == "Stock")
    bond_alloc = next(a for a in adv["allocation_summary"] if a["asset_type"] == "Bond")
    assert abs(stock_alloc["current_pct"] - 66.67) < 0.1  # 2000/3000
    assert abs(bond_alloc["current_pct"] - 33.33) < 0.1  # 1000/3000


def test_regression_test_8_one_holding_unavailable_ai_reports_incomplete(setup_user_and_clean_holdings):
    """TEST 8: One holding has unavailable price -> System reports incomplete live valuation, does NOT treat unavailable as 0."""
    headers = setup_user_and_clean_holdings
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        h_unpriced = Portfolio(
            user_id=user.id,
            symbol="TCS",
            normalized_symbol="UNAVAILABLE-STOCK.NS",
            asset_name="Tata Consultancy Services",
            asset_type="Stock",
            quantity=400.0,
            average_buy_price=4590.0,
            manual_price=None
        )
        h_bond = Portfolio(
            user_id=user.id,
            symbol="GOVT-BOND",
            normalized_symbol="",
            asset_name="Government Bond",
            asset_type="Bond",
            quantity=150.0,
            average_buy_price=1000.0,
            manual_price=1000.0
        )
        db.add(h_unpriced)
        db.add(h_bond)
        db.commit()
    finally:
        db.close()

    r = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r.status_code == 200
    adv = r.json()
    assert adv["is_fallback"] is True
    assert "Invested Value" in adv["valuation_basis"]
    assert adv["unavailable_count"] >= 1
    assert "TCS" in adv["unavailable_symbols"] or "UNAVAILABLE-STOCK.NS" in adv["unavailable_symbols"]
    
    # Stock is NOT 0% and Bond is NOT 100%
    stock_alloc = next(a for a in adv["allocation_summary"] if a["asset_type"] == "Stock")
    bond_alloc = next(a for a in adv["allocation_summary"] if a["asset_type"] == "Bond")
    assert stock_alloc["current_pct"] > 50.0  # Approx 92.45%
    assert bond_alloc["current_pct"] < 50.0   # Approx 7.55%
    assert adv["portfolio_risk"] == "aggressive"


# ==============================================================================
# SECTION 23 SPECIFIC TEST SCENARIOS (TEST 1 to TEST 7)
# ==============================================================================

def test_section_23_test_1_valid_nse_stock(setup_user_and_clean_holdings):
    """TEST 1: Ticker: TCS, Stock, Quantity 10, Avg Buy Price 4000 -> Normalized: TCS.NS, saved successfully."""
    headers = setup_user_and_clean_holdings
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "TCS",
        "asset_name": "Tata Consultancy Services",
        "asset_type": "Stock",
        "quantity": 10.0,
        "average_buy_price": 4000.0
    })
    assert r.status_code == 201
    data = r.json()
    assert data["symbol"] == "TCS"
    assert data["normalized_symbol"] == "TCS.NS"
    assert data["price_source"] in ["LIVE", "UNAVAILABLE"]
    assert data["total_investment_value"] == 40000.0


def test_section_23_test_2_already_normalized_ticker():
    """TEST 2: Already normalized ticker TCS.NS -> TCS.NS (never TCS.NS.NS)."""
    assert normalize_symbol_for_yahoo("TCS.NS", "Stock") == "TCS.NS"
    assert normalize_symbol_for_yahoo("RELIANCE.NS", "Stock") == "RELIANCE.NS"
    assert normalize_symbol_for_yahoo("TCS.BO", "Stock") == "TCS.BO"


def test_section_23_test_3_bond(setup_user_and_clean_holdings):
    """TEST 3: Bond GOVT-BOND (150 @ 1000, manual price 1000) -> MANUAL, Current Value = 150000, P/L = 0."""
    headers = setup_user_and_clean_holdings
    r = client.post("/api/v1/portfolio", headers=headers, json={
        "symbol": "GOVT-BOND",
        "asset_name": "Government Bond",
        "asset_type": "Bond",
        "quantity": 150.0,
        "average_buy_price": 1000.0,
        "manual_price": 1000.0
    })
    assert r.status_code == 201
    item = r.json()
    assert item["price_source"] == "MANUAL"
    assert item["current_value"] == 150000.0
    assert item["profit_loss"] == 0.0
    assert item["profit_loss_percentage"] == 0.0


def test_section_23_test_4_one_live_and_one_unavailable(setup_user_and_clean_holdings):
    """TEST 4: One unpriced stock + one manual bond -> both appear, API succeeds, allocation uses consistent invested fallback."""
    headers = setup_user_and_clean_holdings
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        h1 = Portfolio(
            user_id=user.id,
            symbol="TCS",
            normalized_symbol="UNAVAILABLE.NS",
            asset_name="Tata Consultancy Services",
            asset_type="Stock",
            quantity=400.0,
            average_buy_price=4590.0,
            manual_price=None
        )
        h2 = Portfolio(
            user_id=user.id,
            symbol="GOVT-BOND",
            normalized_symbol="",
            asset_name="Government Bond",
            asset_type="Bond",
            quantity=150.0,
            average_buy_price=1000.0,
            manual_price=1000.0
        )
        db.add(h1)
        db.add(h2)
        db.commit()
    finally:
        db.close()

    r = client.get("/api/v1/portfolio", headers=headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2
    
    r_adv = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r_adv.status_code == 200
    adv = r_adv.json()
    assert adv["is_fallback"] is True
    assert "Invested Value" in adv["valuation_basis"]


def test_section_23_test_5_all_market_prices_available(setup_user_and_clean_holdings):
    """TEST 5: All market prices available -> Current portfolio value is accurate, P/L accurate, allocation uses market values."""
    headers = setup_user_and_clean_holdings
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "john@example.com").first()
        h1 = Portfolio(
            user_id=user.id,
            symbol="STOCK-1",
            normalized_symbol="",
            asset_name="Stock 1",
            asset_type="Stock",
            quantity=10.0,
            average_buy_price=100.0,
            manual_price=150.0
        )
        h2 = Portfolio(
            user_id=user.id,
            symbol="ETF-1",
            normalized_symbol="",
            asset_name="ETF 1",
            asset_type="ETF",
            quantity=10.0,
            average_buy_price=100.0,
            manual_price=100.0
        )
        db.add(h1)
        db.add(h2)
        db.commit()
    finally:
        db.close()

    r = client.get("/api/v1/advisor/rebalancing", headers=headers)
    assert r.status_code == 200
    adv = r.json()
    assert adv["is_fallback"] is False
    assert adv["valuation_basis"] == "Live Market Value"
    assert adv["total_portfolio_value"] == 2500.0  # 1500 + 1000


def test_section_23_test_6_moderate_portfolio():
    """TEST 6: Moderate portfolio target (Stock 40, ETF 25, Bond 25, Cash 10) -> All asset classes verified in summary."""
    allocs = {"Stock": 40.0, "ETF": 25.0, "Bond": 25.0, "Cash": 10.0}
    recs = _generate_recommendations("moderate", allocs, TARGET_ALLOCATIONS["moderate"])
    assert len(recs) == 0  # Well balanced


def test_section_23_test_7_aggressive_portfolio():
    """TEST 7: Aggressive portfolio (>70% stock) -> Portfolio Risk = Aggressive, Moderate user -> Rebalancing Recommended."""
    allocs = {"Stock": 75.0, "ETF": 10.0, "Bond": 10.0, "Cash": 5.0}
    risk = _portfolio_risk_level(allocs)
    assert risk == "aggressive"
    
    recs = _generate_recommendations("moderate", allocs, TARGET_ALLOCATIONS["moderate"])
    assert len(recs) > 0
    stock_rec = next(r for r in recs if r["asset_type"] == "Stock")
    assert stock_rec["status"] == "OVERWEIGHT"
    assert stock_rec["action"] == "reduce"

