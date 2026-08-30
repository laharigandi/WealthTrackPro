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
        
        # 1. Expense at retirement
        inflation = req.expected_inflation_rate / 100
        expense_at_retirement = req.current_monthly_expenses * math.pow(1 + inflation, years_to_retirement)
        
        # 2. Required Corpus at retirement (using inflation-adjusted return post-retirement)
        r_post = req.expected_return_post_retirement / 100
        real_return_post = (1 + r_post) / (1 + inflation) - 1
        real_r_monthly = real_return_post / 12
        months_in_retirement = years_in_retirement * 12
        
        if real_r_monthly > 0:
            required_corpus = expense_at_retirement * (1 - math.pow(1 + real_r_monthly, -months_in_retirement)) / real_r_monthly
        else:
            required_corpus = expense_at_retirement * months_in_retirement
            
        # 3. Future value of current savings
        r_pre = req.expected_return_pre_retirement / 100
        r_pre_monthly = r_pre / 12
        months_to_retirement = years_to_retirement * 12
        
        if r_pre_monthly > 0:
            expected_corpus = req.current_savings * math.pow(1 + r_pre_monthly, months_to_retirement)
        else:
            expected_corpus = req.current_savings

        # 4. Shortfall & Required Monthly Investment
        shortfall = max(0.0, required_corpus - expected_corpus)
        
        if shortfall > 0 and r_pre_monthly > 0 and months_to_retirement > 0:
            additional_monthly_inv = shortfall * r_pre_monthly / (math.pow(1 + r_pre_monthly, months_to_retirement) - 1)
        else:
            additional_monthly_inv = shortfall / months_to_retirement if months_to_retirement > 0 else 0.0

        readiness = (expected_corpus / required_corpus * 100) if required_corpus > 0 else 100.0
        readiness = min(100.0, readiness)

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

    @field_validator("loan_amount", "annual_interest_rate", "loan_tenure_years")
    @classmethod
    def must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Values must be greater than zero.")
        return v

class LoanResponse(BaseModel):
    monthly_emi: float
    total_payable_original: float
    total_interest_original: float
    total_payable_new: float
    total_interest_new: float
    interest_saved: float
    time_saved_months: int
    new_tenure_months: int

@router.post("/loan", response_model=LoanResponse)
def loan_calculator(req: LoanRequest):
    try:
        P = req.loan_amount
        r = (req.annual_interest_rate / 100) / 12
        n = int(req.loan_tenure_years * 12)

        # Standard EMI
        if r > 0:
            emi = P * r * math.pow(1 + r, n) / (math.pow(1 + r, n) - 1)
        else:
            emi = P / n

        total_payable_original = emi * n
        total_interest_original = total_payable_original - P

        # With Extra Payment
        new_emi = emi + (req.extra_monthly_payment or 0.0)
        
        if req.extra_monthly_payment and req.extra_monthly_payment > 0:
            if r > 0:
                # n = -log(1 - (P*r)/new_emi) / log(1+r)
                if (P * r) >= new_emi:
                    # Technically won't happen if emi covers P*r, which it does.
                    new_n = n
                else:
                    new_n_exact = -math.log(1 - (P * r) / new_emi) / math.log(1 + r)
                    new_n = math.ceil(new_n_exact)
            else:
                new_n = math.ceil(P / new_emi)
        else:
            new_n = n

        # Precise calculation of last month's payment
        balance = P
        total_interest_new = 0.0
        months_taken = 0
        
        while balance > 0 and months_taken < new_n:
            interest = balance * r
            total_interest_new += interest
            principal_paid = new_emi - interest
            
            if principal_paid > balance:
                principal_paid = balance
                
            balance -= principal_paid
            months_taken += 1

        total_payable_new = P + total_interest_new
        interest_saved = max(0.0, total_interest_original - total_interest_new)
        time_saved = max(0, n - months_taken)

        return LoanResponse(
            monthly_emi=round(emi, 2),
            total_payable_original=round(total_payable_original, 2),
            total_interest_original=round(total_interest_original, 2),
            total_payable_new=round(total_payable_new, 2),
            total_interest_new=round(total_interest_new, 2),
            interest_saved=round(interest_saved, 2),
            time_saved_months=time_saved,
            new_tenure_months=months_taken
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
