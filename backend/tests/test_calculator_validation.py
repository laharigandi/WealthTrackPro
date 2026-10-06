import math
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_testcase_1_retirement_life_expectancy_65():
    """
    TEST CASE 1:
    Current Age = 30
    Retirement Age = 60
    Life Expectancy = 65
    Inflation = 6%
    Monthly Expenses = ₹50,000
    Current Savings = ₹1,00,000
    Pre-retirement Return = 12%
    Post-retirement Return = 8%

    Expected:
    - Years to retirement = 30
    - Retirement duration = 5 years
    - Estimated monthly expense ≈ ₹2,87,175
    - Expected corpus from savings = 100000 * (1.12)^30 ≈ ₹29,95,992.21
    - Required corpus ≈ ₹1,64,30,368.14
    - Shortfall ≈ ₹1,34,34,375.93
    - Additional monthly SIP ≈ ₹3,843.92
    - Readiness ≈ 18.23%
    """
    r = client.post("/api/v1/calculator/retirement", json={
        "current_age": 30,
        "retirement_age": 60,
        "life_expectancy": 65,
        "expected_inflation_rate": 6.0,
        "current_monthly_expenses": 50000.0,
        "current_savings": 100000.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["years_to_retirement"] == 30
    assert abs(data["estimated_monthly_expense_at_retirement"] - 287174.56) < 1.0
    assert abs(data["expected_corpus_from_savings"] - 2995992.21) < 1.0
    assert abs(data["required_retirement_corpus"] - 16430368.14) < 1.0
    assert abs(data["shortfall"] - 13434375.93) < 1.0
    assert abs(data["additional_monthly_investment_required"] - 3843.92) < 1.0
    assert abs(data["retirement_readiness_percentage"] - 18.23) < 0.1


def test_testcase_2_retirement_life_expectancy_85():
    """
    TEST CASE 2:
    Current Age = 30
    Retirement Age = 60
    Life Expectancy = 85
    Inflation = 6%
    Monthly Expenses = ₹50,000
    Current Savings = ₹1,00,000
    Pre-retirement Return = 12%
    Post-retirement Return = 8%

    Expected:
    - Years to retirement = 30
    - Retirement duration = 25 years
    - Estimated monthly expense ≈ ₹2,87,175
    - Expected corpus from savings = 100000 * (1.12)^30 ≈ ₹29,95,992.21
    - Required corpus ≈ ₹6,86,42,173.93
    - Shortfall ≈ ₹6,56,46,181.72
    - Additional monthly SIP ≈ ₹18,783.08
    - Readiness ≈ 4.36%
    """
    r = client.post("/api/v1/calculator/retirement", json={
        "current_age": 30,
        "retirement_age": 60,
        "life_expectancy": 85,
        "expected_inflation_rate": 6.0,
        "current_monthly_expenses": 50000.0,
        "current_savings": 100000.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["years_to_retirement"] == 30
    assert abs(data["estimated_monthly_expense_at_retirement"] - 287174.56) < 1.0
    assert abs(data["expected_corpus_from_savings"] - 2995992.21) < 1.0
    assert abs(data["required_retirement_corpus"] - 68642173.93) < 1.0
    assert abs(data["shortfall"] - 65646181.72) < 1.0
    assert abs(data["additional_monthly_investment_required"] - 18783.08) < 1.0
    assert abs(data["retirement_readiness_percentage"] - 4.36) < 0.1


def test_testcase_3_life_expectancy_equals_retirement_age():
    """
    TEST CASE 3:
    Current Age = 30, Retirement Age = 60, Life Expectancy = 60
    Expected:
    HTTP 422 with "Life expectancy must be greater than retirement age."
    """
    r = client.post("/api/v1/calculator/retirement", json={
        "current_age": 30,
        "retirement_age": 60,
        "life_expectancy": 60,
        "expected_inflation_rate": 6.0,
        "current_monthly_expenses": 50000.0,
        "current_savings": 100000.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r.status_code == 422
    errors = r.json().get("detail", [])
    assert any("Life expectancy must be greater than retirement age" in str(e.get("msg", "")) for e in errors)


def test_testcase_4_retirement_age_equals_current_age():
    """
    TEST CASE 4:
    Current Age = 60, Retirement Age = 60, Life Expectancy = 85
    Expected:
    HTTP 422 with "Retirement age must be greater than current age."
    """
    r = client.post("/api/v1/calculator/retirement", json={
        "current_age": 60,
        "retirement_age": 60,
        "life_expectancy": 85,
        "expected_inflation_rate": 6.0,
        "current_monthly_expenses": 50000.0,
        "current_savings": 100000.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r.status_code == 422
    errors = r.json().get("detail", [])
    assert any("Retirement age must be greater than current age" in str(e.get("msg", "")) for e in errors)


def test_testcase_5_valid_calculation_after_invalid_request():
    """
    TEST CASE 5:
    Send invalid request -> rejected.
    Then send valid request -> calculates normally without issues.
    """
    # Invalid request
    r_invalid = client.post("/api/v1/calculator/retirement", json={
        "current_age": 45,
        "retirement_age": 40,
        "life_expectancy": 80,
        "expected_inflation_rate": 6.0,
        "current_monthly_expenses": 50000.0,
        "current_savings": 100000.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r_invalid.status_code == 422

    # Valid request
    r_valid = client.post("/api/v1/calculator/retirement", json={
        "current_age": 30,
        "retirement_age": 60,
        "life_expectancy": 65,
        "expected_inflation_rate": 6.0,
        "current_monthly_expenses": 50000.0,
        "current_savings": 100000.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r_valid.status_code == 200
    data = r_valid.json()
    assert data["years_to_retirement"] == 30
    assert data["required_retirement_corpus"] > 0


def test_edge_case_current_age_non_positive():
    """Current age <= 0 rejected with 422."""
    r = client.post("/api/v1/calculator/retirement", json={
        "current_age": 0,
        "retirement_age": 60,
        "life_expectancy": 85,
        "expected_inflation_rate": 6.0,
        "current_monthly_expenses": 50000.0,
        "current_savings": 100000.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r.status_code == 422
    errors = r.json().get("detail", [])
    assert any("Current age must be greater than 0" in str(e.get("msg", "")) for e in errors)


def test_edge_case_negative_financial_inputs():
    """Negative financial amounts or rates rejected with 422."""
    r = client.post("/api/v1/calculator/retirement", json={
        "current_age": 30,
        "retirement_age": 60,
        "life_expectancy": 85,
        "expected_inflation_rate": -5.0,
        "current_monthly_expenses": -1000.0,
        "current_savings": -500.0,
        "expected_return_pre_retirement": 12.0,
        "expected_return_post_retirement": 8.0,
    })
    assert r.status_code == 422
    errors = r.json().get("detail", [])
    assert len(errors) >= 1
    assert any("cannot be negative" in str(e.get("msg", "")) for e in errors)


def test_sip_calculator_endpoints():
    """Generic SIP and SIP Inflation calculators work properly."""
    r_sip = client.post("/api/v1/calculator/sip", json={
        "monthly_investment": 10000.0,
        "duration_years": 10.0,
        "expected_annual_return": 12.0
    })
    assert r_sip.status_code == 200
    assert r_sip.json()["future_value"] > 2000000.0

    r_inf = client.post("/api/v1/calculator/sip-inflation", json={
        "current_cost": 5000000.0,
        "years": 10.0,
        "inflation_rate": 6.0,
        "current_savings": 500000.0,
        "expected_return": 12.0,
        "monthly_sip": 30000.0
    })
    assert r_inf.status_code == 200
    assert r_inf.json()["inflation_adjusted_cost"] > 5000000.0


def test_loan_calculator_endpoint():
    """Loan payoff calculator works properly."""
    r_loan = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 20.0,
        "extra_monthly_payment": 5000.0
    })
    assert r_loan.status_code == 200
    data = r_loan.json()
    assert data["monthly_emi"] > 0
    assert data["interest_saved"] > 0
    assert "time_saved_years" in data
    assert "total_payment" in data
    assert "total_interest_paid" in data


def test_loan_testcase_1_normal_loan():
    """TEST 1: Normal loan without extra payment."""
    r = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 20.0,
        "extra_monthly_payment": 0.0
    })
    assert r.status_code == 200
    data = r.json()
    assert abs(data["monthly_emi"] - 43391.16) < 0.1
    assert abs(data["total_payable_original"] - 10413878.8) < 1.0
    assert abs(data["total_interest_original"] - 5413878.8) < 1.0
    assert abs(data["total_payment"] - 10413878.8) < 1.0
    assert abs(data["total_interest_paid"] - 5413878.8) < 1.0
    assert data["interest_saved"] == 0.0
    assert data["time_saved_months"] == 0
    assert data["time_saved_years"] == 0.0
    assert data["new_tenure_months"] == 240


def test_loan_testcase_2_with_extra_payment():
    """TEST 2: Loan with 5,000 extra monthly payment."""
    r = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 20.0,
        "extra_monthly_payment": 5000.0
    })
    assert r.status_code == 200
    data = r.json()
    assert data["monthly_emi"] == 43391.16
    assert data["interest_saved"] > 1000000.0
    assert data["time_saved_months"] > 40
    assert data["time_saved_years"] > 3.0
    assert data["new_tenure_months"] < 240
    assert data["total_payment"] < data["total_payable_original"]
    assert data["total_interest_paid"] < data["total_interest_original"]


def test_loan_testcase_3_empty_extra_payment():
    """TEST 3: Loan without extra_monthly_payment field (defaults to 0)."""
    r = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 20.0
    })
    assert r.status_code == 200
    data = r.json()
    assert data["monthly_emi"] == 43391.16
    assert data["interest_saved"] == 0.0
    assert data["time_saved_months"] == 0
    assert data["time_saved_years"] == 0.0


def test_loan_testcase_4_zero_interest():
    """TEST 4: Zero interest rate (0%)."""
    r = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 1000000.0,
        "annual_interest_rate": 0.0,
        "loan_tenure_years": 10.0,
        "extra_monthly_payment": 0.0
    })
    assert r.status_code == 200
    data = r.json()
    assert data["monthly_emi"] == 8333.33
    assert data["total_payable_original"] == 1000000.0
    assert data["total_interest_original"] == 0.0
    assert data["total_payment"] == 1000000.0
    assert data["total_interest_paid"] == 0.0
    assert data["interest_saved"] == 0.0
    assert data["new_tenure_months"] == 120


def test_loan_testcase_5_empty_required_fields():
    """TEST 5: Missing required fields rejected with 422."""
    r_empty = client.post("/api/v1/calculator/loan", json={})
    assert r_empty.status_code == 422

    r_missing_rate = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "loan_tenure_years": 20.0
    })
    assert r_missing_rate.status_code == 422


def test_loan_testcase_6_negative_and_zero_values():
    """TEST 6: Negative and invalid values rejected with 422."""
    # Negative loan amount
    r_neg_amt = client.post("/api/v1/calculator/loan", json={
        "loan_amount": -5000000.0,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 20.0
    })
    assert r_neg_amt.status_code == 422

    # Negative interest rate
    r_neg_rate = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "annual_interest_rate": -8.5,
        "loan_tenure_years": 20.0
    })
    assert r_neg_rate.status_code == 422

    # Negative tenure
    r_neg_tenure = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": -20.0
    })
    assert r_neg_tenure.status_code == 422

    # Negative extra payment
    r_neg_extra = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 5000000.0,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 20.0,
        "extra_monthly_payment": -5000.0
    })
    assert r_neg_extra.status_code == 422


def test_loan_testcase_7_decimal_values():
    """TEST 7: Decimal values work accurately."""
    r = client.post("/api/v1/calculator/loan", json={
        "loan_amount": 2500000.50,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 15.5,
        "extra_monthly_payment": 2500.75
    })
    assert r.status_code == 200
    data = r.json()
    assert data["monthly_emi"] > 0
    assert data["total_payment"] > 0
    assert data["total_interest_paid"] > 0
    assert not math.isnan(data["monthly_emi"])
    assert not math.isinf(data["monthly_emi"])

