from datetime import datetime
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.goal import Goal
from app.models.portfolio import Portfolio
from app.models.notification import Notification
from app.services.market_service import MarketService

def format_indian_currency(val: float) -> str:
    if val is None:
        return "₹0"
    try:
        val = float(val)
    except (ValueError, TypeError):
        return "₹0"
    is_negative = val < 0
    val = abs(val)
    s = str(int(round(val)))
    if len(s) <= 3:
        formatted = s
    else:
        last_three = s[-3:]
        other_parts = s[:-3]
        res = []
        while len(other_parts) > 0:
            res.append(other_parts[-2:])
            other_parts = other_parts[:-2]
        res.reverse()
        formatted = ",".join(res) + "," + last_three
    sign = "-" if is_negative else ""
    return f"{sign}₹{formatted}"

def get_asset_classification(asset_type: str) -> str:
    if not asset_type:
        return "unknown"
    val = asset_type.strip().lower()
    if val in ["stocks", "stock", "equity", "equity mutual funds", "equity mutual fund", "crypto", "cryptocurrency"]:
        return "equity"
    elif val in ["fixed deposit", "fd", "bonds", "bond", "debt mutual fund", "debt mutual funds", "fixed income"]:
        return "debt"
    elif val in ["cash", "liquid fund", "liquid funds", "cash equivalent"]:
        return "cash"
    else:
        return "unknown"

class NotificationService:
    @staticmethod
    def generate_and_get_notifications(db: Session, user: User) -> list[Notification]:
        active_alerts = []

        # 1. KYC status check
        kyc_status = (user.kyc_status or "").strip().lower()
        if kyc_status != "verified":
            user_name = f" {user.name}" if user.name else ""
            active_alerts.append({
                "unique_key": "kyc-alert",
                "type": "kyc_alert",
                "title": "🛡️ Complete Your KYC",
                "message": f"Hello{user_name}, complete your KYC verification to unlock automated goal investing.",
                "severity": "warning"
            })

        # 2. Goal Progress alerts
        goals = db.query(Goal).filter(Goal.user_id == user.id).all()
        for goal in goals:
            target = float(goal.target_amount)
            if target <= 0:
                continue
            saved = float(goal.current_amount)
            progress = (saved / target) * 100
            # Clamp progress 0 - 100
            progress = min(100.0, max(0.0, progress))
            goal_title = goal.title or "Goal"

            user_greeting = f" {user.name}" if user.name else ""

            if progress >= 100:
                active_alerts.append({
                    "unique_key": f"goal-{goal.id}-completed",
                    "type": "goal_completed",
                    "title": "🎉 Goal Completed!",
                    "message": f"Congratulations{user_greeting}! You reached 100% of your '{goal_title}' target ({format_indian_currency(target)}).",
                    "severity": "success"
                })
            elif progress >= 50:
                active_alerts.append({
                    "unique_key": f"goal-{goal.id}-milestone-50",
                    "type": "goal_milestone",
                    "title": "🎯 Milestone Reached",
                    "message": f"Great job! You are at {progress:.1f}% for '{goal_title}'. Saved {format_indian_currency(saved)} out of {format_indian_currency(target)}.",
                    "severity": "info"
                })

        # 3. Portfolio risk and growth milestones
        holdings = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
        total_portfolio_value = 0.0
        equity_value = 0.0

        for h in holdings:
            try:
                quote = MarketService.get_quote(h.symbol)
                current_price = float(quote.get("price", h.average_buy_price))
            except Exception:
                current_price = float(h.average_buy_price)
            
            qty = float(h.quantity)
            val = qty * current_price
            total_portfolio_value += val

            classification = get_asset_classification(h.asset_type)
            if classification == "equity":
                equity_value += val

        # Moderate equity warning
        risk_profile = (user.risk_profile or "").strip().lower()
        if total_portfolio_value > 0:
            equity_ratio = (equity_value / total_portfolio_value) * 100
        else:
            equity_ratio = 0.0

        if risk_profile == "moderate" and equity_ratio > 70:
            active_alerts.append({
                "unique_key": "portfolio-moderate-equity-alert",
                "type": "portfolio_risk",
                "title": "⚠️ AI Portfolio Alert",
                "message": f"Your risk profile is set to Moderate, but your equity exposure is currently {equity_ratio:.1f}%. Consider rebalancing into Debt/Fixed Income.",
                "severity": "warning"
            })

        # Portfolio growth milestones
        # Support thresholds: ₹10,00,000, ₹25,00,000, ₹50,00,000, ₹1,00,00,000
        thresholds = [10000000.0, 5000000.0, 2500000.0, 1000000.0]
        crossed_threshold = None
        for t in thresholds:
            if total_portfolio_value >= t:
                crossed_threshold = t
                break
        
        if crossed_threshold is not None:
            active_alerts.append({
                "unique_key": f"portfolio-growth-{int(crossed_threshold)}",
                "type": "portfolio_milestone",
                "title": "📈 Portfolio Growth Milestone",
                "message": f"Your total portfolio value has crossed {format_indian_currency(crossed_threshold)}. Check your asset breakdown.",
                "severity": "success"
            })

        # 4. Security / Session Alert
        active_alerts.append({
            "unique_key": "security-session",
            "type": "security",
            "title": "🔐 Security Status",
            "message": "Your current account session is active and secure.",
            "severity": "info"
        })

        # 5. Sync with Database
        db_notifications = db.query(Notification).filter(Notification.user_id == user.id).all()
        db_by_key = {n.unique_key: n for n in db_notifications}
        active_keys = {a["unique_key"] for a in active_alerts}

        # Add or update
        for a in active_alerts:
            key = a["unique_key"]
            if key not in db_by_key:
                new_n = Notification(
                    user_id=user.id,
                    type=a["type"],
                    title=a["title"],
                    message=a["message"],
                    severity=a["severity"],
                    is_read=False,
                    unique_key=key
                )
                db.add(new_n)

        # Delete stale notifications
        for key, n in db_by_key.items():
            if key not in active_keys:
                db.delete(n)

        db.commit()

        # Fetch finalized list sorted by created_at desc
        return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()

    @staticmethod
    def mark_all_as_read(db: Session, user: User) -> int:
        count = db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_read == False
        ).update({"is_read": True}, synchronize_session="fetch")
        db.commit()
        return count

    @staticmethod
    def mark_as_read(db: Session, user: User, notification_id: int) -> Notification:
        n = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user.id
        ).first()
        if n and not n.is_read:
            n.is_read = True
            db.commit()
            db.refresh(n)
        return n
