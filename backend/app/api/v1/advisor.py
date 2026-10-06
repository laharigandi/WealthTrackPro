"""
Smart AI Portfolio Advisor
Rule-based rebalancing recommendations based on current portfolio value and risk profile benchmarks.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.portfolio import Portfolio
from app.api.deps import get_current_user
from app.api.v1.portfolio import enrich_portfolio_item

router = APIRouter(prefix="/advisor", tags=["AI Advisor"])

# ─────────────────────────────────────────────────────────────
# Target allocations per risk profile (percentages, each sums to 100.0%)
# ─────────────────────────────────────────────────────────────
TARGET_ALLOCATIONS: Dict[str, Dict[str, float]] = {
    "conservative": {
        "Stock":       15.0,
        "ETF":         10.0,
        "Mutual Fund": 15.0,
        "Bond":        45.0,
        "Crypto":       0.0,
        "Cash":        15.0,
    },
    "moderate": {
        "Stock":       40.0,
        "ETF":         25.0,
        "Mutual Fund":  0.0,
        "Bond":        25.0,
        "Crypto":       0.0,
        "Cash":        10.0,
    },
    "aggressive": {
        "Stock":       55.0,
        "ETF":         20.0,
        "Mutual Fund": 10.0,
        "Bond":         5.0,
        "Crypto":      10.0,
        "Cash":         0.0,
    },
}

# Threshold (percentage points) beyond which we flag a deviation
DEVIATION_THRESHOLD = 5.0


def _portfolio_risk_level(allocations: Dict[str, float]) -> str:
    """
    Classify portfolio risk level dynamically from current asset allocation:
    - Aggressive: High equity/crypto exposure (>= 65%)
    - Conservative: High debt/cash exposure (>= 55%)
    - Moderate: Balanced exposure
    """
    stock_pct = allocations.get("Stock", 0.0)
    crypto_pct = allocations.get("Crypto", 0.0)
    etf_pct = allocations.get("ETF", 0.0)
    bond_pct = allocations.get("Bond", 0.0) + allocations.get("Fixed Deposit", 0.0)
    cash_pct = allocations.get("Cash", 0.0)
    mf_pct = allocations.get("Mutual Fund", 0.0)

    # Weighted risk calculation
    high_risk_exposure = stock_pct + crypto_pct + (etf_pct * 0.8) + (mf_pct * 0.5)
    low_risk_exposure = bond_pct + cash_pct + (mf_pct * 0.3)

    if high_risk_exposure >= 65.0:
        return "aggressive"
    elif low_risk_exposure >= 55.0:
        return "conservative"
    return "moderate"


def _generate_recommendations(
    risk_profile: str,
    current_pcts: Dict[str, float],
    target_pcts: Dict[str, float],
) -> List[Dict[str, Any]]:
    recommendations = []
    for asset_type, target in target_pcts.items():
        current = current_pcts.get(asset_type, 0.0)
        diff_pp = round(current - target, 2)
        abs_dev = abs(diff_pp)
        if abs_dev >= DEVIATION_THRESHOLD:
            if diff_pp > 0:
                action = "reduce"
                severity = "warning" if abs_dev < 20 else "danger"
                status_label = "OVERWEIGHT"
                message = (
                    f"{asset_type} allocation is {abs_dev:.2f} percentage points above the recommended "
                    f"{target:.0f}% target for your {risk_profile.capitalize()} profile. "
                    f"Consider reducing exposure."
                )
            else:
                action = "increase"
                severity = "info"
                status_label = "UNDERWEIGHT"
                message = (
                    f"{asset_type} allocation is {abs_dev:.2f} percentage points below the recommended "
                    f"{target:.0f}% target for your {risk_profile.capitalize()} profile. "
                    f"Consider increasing exposure."
                )
            recommendations.append({
                "asset_type": asset_type,
                "current_pct": round(current, 2),
                "target_pct": round(target, 2),
                "difference_pp": diff_pp,
                "deviation": diff_pp,
                "status": status_label,
                "action": action,
                "severity": severity,
                "message": message,
            })

    # Sort recommendations by magnitude of deviation (highest first)
    recommendations.sort(key=lambda r: abs(r["difference_pp"]), reverse=True)
    return recommendations


@router.get("/rebalancing")
def get_rebalancing_advice(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Return rule-based portfolio rebalancing advice.
    Compares current portfolio allocation (by current value) against risk-profile benchmark targets.
    """
    risk_profile = (current_user.risk_profile or "moderate").lower()
    if hasattr(risk_profile, "value"):
        risk_profile = risk_profile.value.lower()
    target_allocs = TARGET_ALLOCATIONS.get(risk_profile, TARGET_ALLOCATIONS["moderate"])

    # Fetch holdings
    holdings = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.quantity > 0)
        .all()
    )

    if not holdings:
        return {
            "risk_profile": risk_profile,
            "portfolio_risk": risk_profile,
            "needs_rebalancing": False,
            "total_portfolio_value": 0.0,
            "alert_level": "info",
            "summary": "No portfolio holdings available for rebalancing analysis.",
            "drift_threshold_pp": DEVIATION_THRESHOLD,
            "recommendations": [],
            "allocation_summary": [
                {
                    "asset_type": at,
                    "current_value": 0.0,
                    "current_pct": 0.0,
                    "target_pct": round(target_allocs.get(at, 0.0), 2),
                    "difference_pp": round(0.0 - target_allocs.get(at, 0.0), 2),
                    "status": "UNDERWEIGHT" if target_allocs.get(at, 0.0) > 0 else "BALANCED",
                }
                for at in ["Stock", "ETF", "Bond", "Cash", "Mutual Fund", "Crypto"]
                if at in target_allocs or target_allocs.get(at, 0) > 0
            ],
            "target_allocations": {k: round(v, 1) for k, v in target_allocs.items()},
        }

    # Enrich holdings to get real-time / safe current values
    enriched_items = [enrich_portfolio_item(h) for h in holdings]

    # Check for unavailable live prices
    unavailable_items = [item for item in enriched_items if item.current_value is None]
    has_unavailable_prices = len(unavailable_items) > 0
    missing_symbols = [item.symbol or item.asset_name for item in unavailable_items]

    total_invested = sum(item.total_investment_value or 0.0 for item in enriched_items)

    # Determine allocation basis
    if not has_unavailable_prices:
        # All holdings have valid live or manual prices
        is_fallback = False
        valuation_basis = "Live Market Value"
        total_eval_value = sum(item.current_value for item in enriched_items if item.current_value is not None)
        
        type_values: Dict[str, float] = {}
        for item in enriched_items:
            asset_type = item.asset_type or "Stock"
            type_values[asset_type] = type_values.get(asset_type, 0.0) + (item.current_value or 0.0)
            
        current_pcts: Dict[str, float] = {}
        for asset_type, val in type_values.items():
            current_pcts[asset_type] = (val / total_eval_value * 100.0) if total_eval_value > 0 else 0.0
    else:
        # Fallback to Invested Value allocation to avoid distorting unpriced assets to 0%
        is_fallback = True
        valuation_basis = "Invested Value (Fallback – Live Prices Unavailable)"
        total_eval_value = total_invested
        
        type_values: Dict[str, float] = {}
        for item in enriched_items:
            asset_type = item.asset_type or "Stock"
            # Use current value if available, otherwise total invested value for that holding
            val = item.current_value if item.current_value is not None else (item.total_investment_value or 0.0)
            type_values[asset_type] = type_values.get(asset_type, 0.0) + val
            
        current_pcts: Dict[str, float] = {}
        for asset_type, val in type_values.items():
            current_pcts[asset_type] = (val / total_eval_value * 100.0) if total_eval_value > 0 else 0.0

    # Determine portfolio risk level
    portfolio_risk = _portfolio_risk_level(current_pcts)

    # Generate recommendations against target benchmark
    recommendations = _generate_recommendations(risk_profile, current_pcts, target_allocs)
    needs_rebalancing = (portfolio_risk != risk_profile) or (len(recommendations) > 0)

    # Construct user-friendly summary message
    stock_pct = current_pcts.get("Stock", 0.0)
    bond_pct = current_pcts.get("Bond", 0.0)
    target_stock = target_allocs.get("Stock", 0.0)
    target_etf = target_allocs.get("ETF", 0.0)
    target_bond = target_allocs.get("Bond", 0.0)
    target_cash = target_allocs.get("Cash", 0.0)

    target_desc = f"{target_stock:.0f}% Stock, {target_etf:.0f}% ETF, {target_bond:.0f}% Bond and {target_cash:.0f}% Cash"

    if not recommendations and portfolio_risk == risk_profile:
        summary = (
            f"Your portfolio aligns well with your {risk_profile.capitalize()} risk profile ({target_desc}). "
            "Keep up the systematic investments!"
        )
        alert_level = "success"
    else:
        if stock_pct > 0 and bond_pct > 0:
            alloc_intro = f"Your portfolio has approximately {stock_pct:.2f}% invested in Stock and {bond_pct:.2f}% in Bond, while your {risk_profile.capitalize()} target is {target_desc}."
        elif stock_pct > 0:
            alloc_intro = f"Your portfolio has approximately {stock_pct:.2f}% invested in Stock, while your {risk_profile.capitalize()} target is {target_desc}."
        else:
            alloc_intro = f"Your portfolio allocation deviates from your {risk_profile.capitalize()} target ({target_desc})."

        if portfolio_risk == "aggressive" and risk_profile != "aggressive":
            rec_clause = f"Rebalancing is recommended because equity exposure is significantly above the {risk_profile.capitalize()}-risk target."
        else:
            rec_clause = "Rebalancing is recommended to bring your asset weights back in line with your target profile."

        if is_fallback:
            missing_str = ", ".join(missing_symbols)
            summary = f"{alloc_intro} {rec_clause} (Rebalancing estimate is based on invested values because live market prices are unavailable for: {missing_str})."
        else:
            summary = f"{alloc_intro} {rec_clause}"
        alert_level = "warning"

    # Build comprehensive allocation summary across all 6 standard asset classes
    all_asset_types = ["Stock", "ETF", "Bond", "Cash", "Mutual Fund", "Crypto"]
    allocation_summary = []
    for at in all_asset_types:
        c_pct = round(current_pcts.get(at, 0.0), 2)
        t_pct = round(target_allocs.get(at, 0.0), 2)
        diff_pp = round(c_pct - t_pct, 2)
        if diff_pp >= DEVIATION_THRESHOLD:
            st = "OVERWEIGHT"
        elif diff_pp <= -DEVIATION_THRESHOLD:
            st = "UNDERWEIGHT"
        else:
            st = "BALANCED"

        allocation_summary.append({
            "asset_type": at,
            "current_value": round(type_values.get(at, 0.0), 2),
            "current_pct": c_pct,
            "target_pct": t_pct,
            "difference_pp": diff_pp,
            "status": st,
        })

    return {
        "risk_profile": risk_profile,
        "portfolio_risk": portfolio_risk,
        "needs_rebalancing": needs_rebalancing,
        "total_portfolio_value": round(total_eval_value, 2),
        "total_invested_value": round(total_invested, 2),
        "valuation_basis": valuation_basis,
        "is_fallback": is_fallback,
        "unavailable_count": len(unavailable_items),
        "unavailable_symbols": missing_symbols,
        "alert_level": alert_level,
        "summary": summary,
        "drift_threshold_pp": DEVIATION_THRESHOLD,
        "recommendations": recommendations,
        "allocation_summary": allocation_summary,
        "target_allocations": {k: round(v, 1) for k, v in target_allocs.items()},
    }



