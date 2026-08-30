"""
Smart AI Portfolio Advisor
Rule-based rebalancing recommendations. No external AI API required.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.portfolio import Portfolio
from app.api.deps import get_current_user

router = APIRouter(prefix="/advisor", tags=["AI Advisor"])

# ─────────────────────────────────────────────────────────────
# Target allocations per risk profile  (percentages)
# ─────────────────────────────────────────────────────────────
TARGET_ALLOCATIONS: Dict[str, Dict[str, float]] = {
    "conservative": {
        "Stock":       20.0,
        "ETF":         15.0,
        "Mutual Fund": 30.0,
        "Bond":        30.0,
        "Crypto":       0.0,
    },
    "moderate": {
        "Stock":       40.0,
        "ETF":         25.0,
        "Mutual Fund": 20.0,
        "Bond":        10.0,
        "Crypto":       5.0,
    },
    "aggressive": {
        "Stock":       55.0,
        "ETF":         20.0,
        "Mutual Fund": 10.0,
        "Bond":         0.0,
        "Crypto":      15.0,
    },
}

# Threshold (pp) beyond which we flag a deviation
DEVIATION_THRESHOLD = 10.0


def _portfolio_risk_level(allocations: Dict[str, float]) -> str:
    """Classify current portfolio risk from its allocations."""
    high_risk = allocations.get("Stock", 0) + allocations.get("Crypto", 0)
    low_risk = allocations.get("Bond", 0) + allocations.get("Mutual Fund", 0)
    if high_risk >= 65:
        return "aggressive"
    elif low_risk >= 55:
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
        deviation = current - target
        abs_dev = abs(deviation)
        if abs_dev >= DEVIATION_THRESHOLD:
            if deviation > 0:
                action = "reduce"
                severity = "warning" if abs_dev < 20 else "danger"
                message = (
                    f"{asset_type} allocation is {abs_dev:.1f}pp above the recommended "
                    f"{target:.0f}% for your {risk_profile.capitalize()} profile. "
                    f"Consider reducing exposure."
                )
            else:
                action = "increase"
                severity = "info"
                message = (
                    f"{asset_type} allocation is {abs_dev:.1f}pp below the recommended "
                    f"{target:.0f}% for your {risk_profile.capitalize()} profile. "
                    f"Consider increasing exposure."
                )
            recommendations.append({
                "asset_type": asset_type,
                "current_pct": round(current, 1),
                "target_pct": round(target, 1),
                "deviation": round(deviation, 1),
                "action": action,
                "severity": severity,
                "message": message,
            })
    return recommendations


@router.get("/rebalancing")
def get_rebalancing_advice(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Return rule-based portfolio rebalancing advice.
    Compares current portfolio allocation against risk-profile targets.
    """
    risk_profile = (current_user.risk_profile or "moderate").lower()
    target_allocs = TARGET_ALLOCATIONS.get(risk_profile, TARGET_ALLOCATIONS["moderate"])

    # Fetch holdings
    holdings = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id)
        .all()
    )

    # Calculate total portfolio value using avg buy price (current price fallback)
    total_value = sum(h.quantity * h.average_buy_price for h in holdings)

    # Aggregate by asset type
    type_values: Dict[str, float] = {}
    for h in holdings:
        asset_type = h.asset_type or "Stock"
        type_values[asset_type] = type_values.get(asset_type, 0.0) + (
            h.quantity * h.average_buy_price
        )

    # Compute percentages
    current_pcts: Dict[str, float] = {}
    for asset_type, val in type_values.items():
        current_pcts[asset_type] = (val / total_value * 100) if total_value > 0 else 0.0

    # Portfolio risk level
    portfolio_risk = _portfolio_risk_level(current_pcts)

    # Needs rebalancing?
    needs_rebalancing = portfolio_risk != risk_profile

    # Generate recommendations
    recommendations = _generate_recommendations(risk_profile, current_pcts, target_allocs)

    # Top summary alert
    if not holdings:
        summary = "Add portfolio holdings to receive personalised rebalancing advice."
        alert_level = "info"
    elif not recommendations:
        summary = (
            f"Your portfolio aligns well with your {risk_profile.capitalize()} risk profile. "
            "Keep up the systematic investments!"
        )
        alert_level = "success"
    elif portfolio_risk == "aggressive" and risk_profile != "aggressive":
        summary = (
            f"Your portfolio is more aggressive than your {risk_profile.capitalize()} risk profile. "
            "Consider reducing high-risk asset exposure."
        )
        alert_level = "warning"
    elif portfolio_risk == "conservative" and risk_profile == "aggressive":
        summary = (
            "Your portfolio is more conservative than your Aggressive risk profile. "
            "Consider increasing equity exposure for higher growth."
        )
        alert_level = "info"
    else:
        summary = (
            f"Minor deviations detected from your {risk_profile.capitalize()} target allocation. "
            "Review the recommendations below."
        )
        alert_level = "warning"

    # Build allocation summary
    all_asset_types = ["Stock", "ETF", "Mutual Fund", "Bond", "Crypto"]
    allocation_summary = []
    for at in all_asset_types:
        allocation_summary.append({
            "asset_type": at,
            "current_value": round(type_values.get(at, 0.0), 2),
            "current_pct": round(current_pcts.get(at, 0.0), 1),
            "target_pct": round(target_allocs.get(at, 0.0), 1),
        })

    return {
        "risk_profile": risk_profile,
        "portfolio_risk": portfolio_risk,
        "needs_rebalancing": needs_rebalancing,
        "total_portfolio_value": round(total_value, 2),
        "alert_level": alert_level,
        "summary": summary,
        "recommendations": recommendations,
        "allocation_summary": allocation_summary,
        "target_allocations": {k: round(v, 1) for k, v in target_allocs.items()},
    }
