"""
Wealth Report Data Endpoint
Aggregates all user data for PDF report generation on the frontend.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any, Dict, List

from app.database import get_db
from app.models.user import User
from app.models.goal import Goal
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.services.market_service import MarketService
from app.api.v1.portfolio import enrich_portfolio_item
from app.api.deps import get_current_user


router = APIRouter(prefix="/report", tags=["Wealth Report"])


@router.get("/wealth")
def get_wealth_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns all user data formatted for PDF wealth report generation.
    Does NOT expose passwords or sensitive auth data.
    """
    # ── User Info ──────────────────────────────────────────────
    user_info = {
        "name": current_user.name,
        "email": current_user.email,
        "risk_profile": (current_user.risk_profile or "moderate").capitalize() if isinstance(current_user.risk_profile, str) else getattr(current_user.risk_profile, "value", "Moderate").capitalize(),
        "kyc_status": (current_user.kyc_status or "verified").capitalize() if isinstance(current_user.kyc_status, str) else getattr(current_user.kyc_status, "value", "Verified").capitalize(),
        "created_at": current_user.created_at.strftime("%B %d, %Y") if current_user.created_at else "N/A",
    }

    # ── Portfolio Holdings ─────────────────────────────────────
    holdings = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.quantity > 0)
        .all()
    )

    total_invested = 0.0
    total_current_value = 0.0
    portfolio_data = []
    type_allocation: Dict[str, float] = {}

    for h in holdings:
        item = enrich_portfolio_item(h)
        invested = item.total_investment_value or 0.0
        current_val = item.current_value if item.current_value is not None else invested
        pnl = item.profit_loss if item.profit_loss is not None else 0.0
        pnl_pct = item.profit_loss_percentage if item.profit_loss_percentage is not None else 0.0

        total_invested += invested
        total_current_value += current_val

        # Allocation by type
        at = item.asset_type or "Stock"
        type_allocation[at] = type_allocation.get(at, 0.0) + current_val

        portfolio_data.append({
            "symbol": item.symbol,
            "asset_name": item.asset_name,
            "asset_type": item.asset_type,
            "quantity": item.quantity,
            "average_buy_price": item.average_buy_price,
            "current_price": item.current_price if item.current_price is not None else item.average_buy_price,
            "price_source": item.price_source,
            "price_status": item.price_status,
            "invested_value": invested,
            "current_value": current_val,
            "profit_loss": pnl,
            "profit_loss_pct": pnl_pct,
        })

    total_pnl = total_current_value - total_invested
    net_worth = total_current_value  # extend later with goals/savings if needed

    # ── Goals ──────────────────────────────────────────────────
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .all()
    )

    goals_data = []
    for g in goals:
        progress = (g.current_amount / g.target_amount * 100) if g.target_amount > 0 else 0.0
        remaining = max(0.0, g.target_amount - g.current_amount)
        goals_data.append({
            "title": g.title,
            "category": g.category,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "monthly_contribution": g.monthly_contribution,
            "target_date": g.target_date,
            "expected_return_rate": g.expected_return_rate,
            "progress_pct": round(progress, 1),
            "remaining": round(remaining, 2),
        })

    # ── Recent Transactions ────────────────────────────────────
    recent_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.transaction_date.desc())
        .limit(10)
        .all()
    )

    transactions_data = []
    for tx in recent_txs:
        transactions_data.append({
            "symbol": tx.symbol,
            "type": tx.transaction_type.value if tx.transaction_type else "BUY",
            "quantity": tx.quantity,
            "price": tx.price,
            "amount": tx.amount,
            "date": tx.transaction_date.strftime("%d %b %Y") if tx.transaction_date else "N/A",
        })

    # ── Allocation Summary ─────────────────────────────────────
    allocation_list = []
    for at, val in type_allocation.items():
        pct = (val / total_current_value * 100) if total_current_value > 0 else 0.0
        allocation_list.append({
            "asset_type": at,
            "value": round(val, 2),
            "pct": round(pct, 1),
        })

    # ── AI Advisor & Rebalancing ──────────────────────────────
    from app.api.v1.advisor import get_rebalancing_advice
    advisor_data = get_rebalancing_advice(db=db, current_user=current_user)

    # ── Notifications (Read-Only) ─────────────────────────────
    from app.services.notifications import NotificationService
    notifs = NotificationService.get_user_notifications(db=db, user=current_user)
    notifs_data = [
        {
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]

    # ── Market Summary ─────────────────────────────────────────
    market_overview = MarketService.get_market_overview()[:6]  # Top 6 only

    return {
        "generated_at": __import__("datetime").datetime.now().strftime("%d %B %Y, %I:%M %p"),
        "user": user_info,
        "net_worth": round(net_worth, 2),
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current_value, 2),
        "total_profit_loss": round(total_pnl, 2),
        "total_profit_loss_pct": round((total_pnl / total_invested * 100) if total_invested > 0 else 0.0, 2),
        "portfolio": portfolio_data,
        "advisor": advisor_data,
        "goals": goals_data,
        "notifications": notifs_data,
        "allocation_summary": allocation_list,
        "recent_transactions": transactions_data,
        "market_summary": market_overview,
    }

