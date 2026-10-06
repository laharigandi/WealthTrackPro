"""
Financial Calculators Module
Includes SIP (Goal), Generic SIP, Retirement, and Loan Payoff calculators.
"""
import math
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/calculator", tags=["Calculator"])

# ─────────────────────────────────────────────────────────────
# 1. Goal SIP + Inflation Calculator (Existing)
# ─────────────────────────────────────────────────────────────
class SIPInflationRequest(BaseModel):
    current_cost: float
    years: float
    inflation_rate: float
    current_savings: float
    expected_return: float
    monthly_sip: float
    goal_title: Optional[str] = "Goal"

    @field_validator("current_cost", "years")
    @classmethod
    def must_be_greater_than_zero(cls, v, info):
        if v <= 0:
            field_name = info.field_name.replace("_", " ").capitalize()
            raise ValueError(f"{field_name} must be greater than 0.")
        return v

    @field_validator("inflation_rate", "current_savings", "expected_return", "monthly_sip")
    @classmethod
    def must_be_non_negative(cls, v, info):
        if v < 0:
            field_name = info.field_name.replace("_", " ").capitalize()
            raise ValueError(f"{field_name} cannot be negative.")
        return v

class SIPInflationResponse(BaseModel):
    goal_title: str
    current_cost: float
    inflation_adjusted_cost: float
    current_savings: float
    savings_future_value: float
    amount_still_required: float
    sip_future_value: float
    total_projected_value: float
    required_monthly_sip: float
    current_monthly_sip: float
    is_sip_sufficient: bool
    sip_shortfall: float
    suggested_monthly_sip: float
    months: int
    inflation_rate: float
    expected_return: float
    status: str

@router.post("/sip-inflation", response_model=SIPInflationResponse)
def sip_inflation_calculator(req: SIPInflationRequest):
    n = int(req.years * 12)
    r_monthly = (req.expected_return / 100) / 12

    inflation_adjusted_cost = req.current_cost * math.pow(1 + req.inflation_rate / 100, req.years)
    savings_fv = req.current_savings * math.pow(1 + r_monthly, n) if r_monthly > 0 else req.current_savings
    
    if r_monthly > 0 and n > 0:
        sip_fv = req.monthly_sip * (math.pow(1 + r_monthly, n) - 1) / r_monthly
    else:
        sip_fv = req.monthly_sip * n

    total_projected = savings_fv + sip_fv
    amount_required = max(0.0, inflation_adjusted_cost - savings_fv)

    if amount_required <= 0:
        required_sip = 0.0
    elif r_monthly > 0 and n > 0:
        required_sip = amount_required * r_monthly / (math.pow(1 + r_monthly, n) - 1)
    else:
        required_sip = amount_required / n if n > 0 else 0.0

    is_sufficient = total_projected >= inflation_adjusted_cost
    shortfall_per_month = max(0.0, required_sip - req.monthly_sip)

    return SIPInflationResponse(
        goal_title=req.goal_title or "Goal",
        current_cost=round(req.current_cost, 2),
        inflation_adjusted_cost=round(inflation_adjusted_cost, 2),
        current_savings=round(req.current_savings, 2),
        savings_future_value=round(savings_fv, 2),
        amount_still_required=round(amount_required, 2),
        sip_future_value=round(sip_fv, 2),
        total_projected_value=round(total_projected, 2),
        required_monthly_sip=round(required_sip, 2),
        current_monthly_sip=round(req.monthly_sip, 2),
        is_sip_sufficient=is_sufficient,
        sip_shortfall=round(shortfall_per_month, 2),
        suggested_monthly_sip=round(required_sip, 2),
        months=n,
        inflation_rate=req.inflation_rate,
        expected_return=req.expected_return,
        status="On Track" if is_sufficient else "Shortfall",
    )


# ─────────────────────────────────────────────────────────────
# 2. Generic SIP Calculator
# ─────────────────────────────────────────────────────────────
class GenericSIPRequest(BaseModel):
    monthly_investment: float
    duration_years: float
    expected_annual_return: float

    @field_validator("monthly_investment", "duration_years", "expected_annual_return")
    @classmethod
    def must_be_positive(cls, v):
        if v < 0:
            raise ValueError("Values must be non-negative.")
        return v

class GenericSIPResponse(BaseModel):
    total_invested: float
    estimated_returns: float
    future_value: float

@router.post("/sip", response_model=GenericSIPResponse)
def sip_calculator(req: GenericSIPRequest):
    try:
        n = int(req.duration_years * 12)
        r_monthly = (req.expected_annual_return / 100) / 12
        total_invested = req.monthly_investment * n
        
        if r_monthly > 0 and n > 0:
            future_value = req.monthly_investment * (math.pow(1 + r_monthly, n) - 1) / r_monthly
        else:
            future_value = total_invested

        estimated_returns = max(0.0, future_value - total_invested)

        return GenericSIPResponse(
            total_invested=round(total_invested, 2),
            estimated_returns=round(estimated_returns, 2),
            future_value=round(future_value, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


# ─────────────────────────────────────────────────────────────
# 3. Retirement Calculator
# ─────────────────────────────────────────────────────────────
class RetirementRequest(BaseModel):
    current_age: int
    retirement_age: int
    current_monthly_expenses: float
    current_savings: float
    expected_inflation_rate: float
    expected_return_pre_retirement: float
    expected_return_post_retirement: float
    life_expectancy: int

    @field_validator("current_age")
    @classmethod
    def check_current_age(cls, v):
        if v <= 0:
            raise ValueError("Current age must be greater than 0.")
        return v

    @field_validator(
        "current_monthly_expenses",
        "current_savings",
        "expected_inflation_rate",
        "expected_return_pre_retirement",
        "expected_return_post_retirement"
    )
    @classmethod
    def check_non_negative(cls, v, info):
        if v < 0:
            field_name = info.field_name.replace("_", " ").capitalize()
            raise ValueError(f"{field_name} cannot be negative.")
        return v

    @field_validator("retirement_age")
    @classmethod
    def check_ages(cls, v, info):
        if "current_age" in info.data and v <= info.data["current_age"]:
            raise ValueError("Retirement age must be greater than current age.")
        return v
    
    @field_validator("life_expectancy")
    @classmethod
    def check_life_expectancy(cls, v, info):
        if "retirement_age" in info.data and v <= info.data["retirement_age"]:
            raise ValueError("Life expectancy must be greater than retirement age.")
        return v

class RetirementResponse(BaseModel):
    years_to_retirement: int
    estimated_monthly_expense_at_retirement: float
    required_retirement_corpus: float
    expected_corpus_from_savings: float
    additional_monthly_investment_required: float
    shortfall: float
    retirement_readiness_percentage: float

@router.post("/retirement", response_model=RetirementResponse)
def retirement_calculator(req: RetirementRequest):
    try:
        years_to_retirement = req.retirement_age - req.current_age
        years_in_retirement = req.life_expectancy - req.retirement_age
        months_to_retirement = years_to_retirement * 12
        months_in_retirement = years_in_retirement * 12
        
        # 1. Monthly Expense at retirement adjusted for inflation
        inflation = req.expected_inflation_rate / 100
        expense_at_retirement = req.current_monthly_expenses * math.pow(1 + inflation, years_to_retirement)
        
        # 2. Required Corpus at retirement (using inflation-adjusted real return post-retirement)
        r_post = req.expected_return_post_retirement / 100
        if 1 + inflation > 0:
            real_return_post = (1 + r_post) / (1 + inflation) - 1
        else:
            real_return_post = r_post

        real_r_monthly = real_return_post / 12
        
        if abs(real_r_monthly) > 1e-7:
            required_corpus = expense_at_retirement * (1 - math.pow(1 + real_r_monthly, -months_in_retirement)) / real_r_monthly
        else:
            required_corpus = expense_at_retirement * months_in_retirement
            
        # 3. Future value of current savings (compounded annually over years to retirement)
        r_pre = req.expected_return_pre_retirement / 100
        if r_pre > 0:
            expected_corpus = req.current_savings * math.pow(1 + r_pre, years_to_retirement)
        else:
            expected_corpus = req.current_savings

        # 4. Shortfall & Required Monthly Investment
        shortfall = max(0.0, required_corpus - expected_corpus)
        
        r_pre_monthly = r_pre / 12
        if shortfall > 0 and r_pre_monthly > 0 and months_to_retirement > 0:
            additional_monthly_inv = shortfall * r_pre_monthly / (math.pow(1 + r_pre_monthly, months_to_retirement) - 1)
        elif shortfall > 0 and months_to_retirement > 0:
            additional_monthly_inv = shortfall / months_to_retirement
        else:
            additional_monthly_inv = 0.0

        readiness = (expected_corpus / required_corpus * 100) if required_corpus > 0 else 100.0
        readiness = min(100.0, max(0.0, readiness))

        return RetirementResponse(
            years_to_retirement=years_to_retirement,
            estimated_monthly_expense_at_retirement=round(expense_at_retirement, 2),
            required_retirement_corpus=round(required_corpus, 2),
            expected_corpus_from_savings=round(expected_corpus, 2),
            additional_monthly_investment_required=round(additional_monthly_inv, 2),
            shortfall=round(shortfall, 2),
            retirement_readiness_percentage=round(readiness, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


# ─────────────────────────────────────────────────────────────
# 4. Loan Payoff Calculator
# ─────────────────────────────────────────────────────────────
class LoanRequest(BaseModel):
    loan_amount: float
    annual_interest_rate: float
    loan_tenure_years: float
    extra_monthly_payment: Optional[float] = 0.0

    @field_validator("loan_amount")
    @classmethod
    def check_loan_amount(cls, v):
        if v <= 0:
            raise ValueError("Loan amount must be greater than 0.")
        return v

    @field_validator("annual_interest_rate")
    @classmethod
    def check_annual_interest_rate(cls, v):
        if v < 0:
            raise ValueError("Interest rate cannot be negative.")
        return v

    @field_validator("loan_tenure_years")
    @classmethod
    def check_loan_tenure(cls, v):
        if v <= 0:
            raise ValueError("Loan tenure must be greater than 0.")
        return v

    @field_validator("extra_monthly_payment")
    @classmethod
    def check_extra_monthly_payment(cls, v):
        if v is not None and v < 0:
            raise ValueError("Extra monthly payment cannot be negative.")
        return v or 0.0

class LoanResponse(BaseModel):
    monthly_emi: float
    total_payable_original: float
    total_interest_original: float
    total_payable_new: float
    total_interest_new: float
    total_payment: float
    total_interest_paid: float
    interest_saved: float
    time_saved_months: int
    time_saved_years: float
    new_tenure_months: int
    new_tenure_years: float

@router.post("/loan", response_model=LoanResponse)
def loan_calculator(req: LoanRequest):
    try:
        P = float(req.loan_amount)
        annual_rate = float(req.annual_interest_rate)
        tenure_years = float(req.loan_tenure_years)
        extra_payment = float(req.extra_monthly_payment or 0.0)

        n = int(round(tenure_years * 12))
        if n <= 0:
            raise ValueError("Loan tenure in months must be at least 1.")

        r = (annual_rate / 100.0) / 12.0

        # Standard EMI
        if r > 0:
            emi = P * r * math.pow(1 + r, n) / (math.pow(1 + r, n) - 1)
        else:
            emi = P / n

        total_payable_original = emi * n
        total_interest_original = max(0.0, total_payable_original - P)

        # With Extra Payment
        new_emi = emi + extra_payment

        if extra_payment > 0:
            balance = P
            total_interest_new = 0.0
            months_taken = 0
            max_months = n * 2

            while balance > 1e-6 and months_taken < max_months:
                interest = balance * r
                total_interest_new += interest
                principal_paid = new_emi - interest

                if principal_paid >= balance:
                    principal_paid = balance
                    balance = 0.0
                    months_taken += 1
                    break
                else:
                    balance -= principal_paid
                    months_taken += 1

            total_payable_new = P + total_interest_new
            interest_saved = max(0.0, total_interest_original - total_interest_new)
            time_saved_months = max(0, n - months_taken)
        else:
            months_taken = n
            total_payable_new = total_payable_original
            total_interest_new = total_interest_original
            interest_saved = 0.0
            time_saved_months = 0

        time_saved_years = round(time_saved_months / 12.0, 1)
        new_tenure_years = round(months_taken / 12.0, 1)

        return LoanResponse(
            monthly_emi=round(emi, 2),
            total_payable_original=round(total_payable_original, 2),
            total_interest_original=round(total_interest_original, 2),
            total_payable_new=round(total_payable_new, 2),
            total_interest_new=round(total_interest_new, 2),
            total_payment=round(total_payable_new, 2),
            total_interest_paid=round(total_interest_new, 2),
            interest_saved=round(interest_saved, 2),
            time_saved_months=time_saved_months,
            time_saved_years=time_saved_years,
            new_tenure_months=months_taken,
            new_tenure_years=new_tenure_years,
        )
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
