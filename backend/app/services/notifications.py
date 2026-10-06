import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.goal import Goal
from app.models.portfolio import Portfolio
from app.models.notification import Notification

logger = logging.getLogger(__name__)


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


class NotificationStreamManager:
    """
    In-memory pub/sub manager for Server-Sent Events (SSE) connections per user.
    """
    def __init__(self):
        self._subscribers: Dict[int, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def get_or_set_loop(self) -> Optional[asyncio.AbstractEventLoop]:
        if self._loop is None or not self._loop.is_running():
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        return self._loop

    async def subscribe(self, user_id: int) -> asyncio.Queue:
        self.get_or_set_loop()
        async with self._lock:
            q = asyncio.Queue(maxsize=100)
            if user_id not in self._subscribers:
                self._subscribers[user_id] = set()
            self._subscribers[user_id].add(q)
            logger.info(f"User {user_id} subscribed to notification stream. Active listeners: {len(self._subscribers[user_id])}")
            return q

    async def unsubscribe(self, user_id: int, q: asyncio.Queue):
        async with self._lock:
            if user_id in self._subscribers:
                self._subscribers[user_id].discard(q)
                if not self._subscribers[user_id]:
                    del self._subscribers[user_id]
            logger.info(f"User {user_id} unsubscribed from notification stream.")

    async def broadcast_to_user(self, user_id: int, event_type: str, data: Any):
        async with self._lock:
            queues = list(self._subscribers.get(user_id, set()))

        if not queues:
            return

        payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        for q in queues:
            try:
                if q.full():
                    try:
                        q.get_nowait()
                    except Exception:
                        pass
                await q.put(payload)
            except Exception as e:
                logger.warning(f"Error queueing SSE message for user {user_id}: {e}")

    def dispatch_to_user(self, user_id: int, event_type: str, data: Any):
        """
        Thread-safe dispatch of SSE events to the user's active streams.
        Works seamlessly from async event loops and sync AnyIO threadpool worker threads.
        """
        if user_id not in self._subscribers or not self._subscribers[user_id]:
            return

        loop = self.get_or_set_loop()
        coro = self.broadcast_to_user(user_id, event_type, data)

        try:
            curr_loop = asyncio.get_running_loop()
            if curr_loop.is_running():
                curr_loop.create_task(coro)
                return
        except RuntimeError:
            pass

        if loop is not None and loop.is_running():
            asyncio.run_coroutine_threadsafe(coro, loop)
        else:
            coro.close()
            logger.debug(f"Could not dispatch SSE event to user {user_id}: No running event loop.")


notification_stream_manager = NotificationStreamManager()


class NotificationService:
    @classmethod
    def evaluate_user_alerts(cls, db: Session, user: User) -> List[Notification]:
        """
        Evaluate all dynamic alerts from PostgreSQL (Portfolio, Goals, KYC, AI Advisor, PnL)
        and synchronize with the notifications table idempotently without duplicate records.
        """
        active_alerts: List[Dict[str, Any]] = []

        # 1. KYC status check
        kyc_status = (user.kyc_status or "pending").strip().lower()
        if hasattr(kyc_status, "value"):
            kyc_status = kyc_status.value.lower()

        if kyc_status != "verified":
            active_alerts.append({
                "unique_key": "kyc:pending",
                "type": "kyc_alert",
                "title": "🛡️ KYC Verification Required",
                "message": "Please complete your KYC verification to access all financial planning features.",
                "severity": "warning",
                "entity_type": "user",
                "entity_id": user.id,
                "milestone": None,
            })

        # 2. Goal Progress & Milestone alerts (50%, 75%, 100%)
        goals = db.query(Goal).filter(Goal.user_id == user.id).all()
        for goal in goals:
            target = float(goal.target_amount or 0.0)
            if target <= 0:
                continue
            saved = float(goal.current_amount or 0.0)
            progress = (saved / target) * 100.0
            goal_title = goal.title or "Goal"

            # 100% Milestone / Goal Completed
            if progress >= 100.0:
                active_alerts.append({
                    "unique_key": f"goal:{goal.id}:milestone:100",
                    "type": "goal_completed",
                    "title": "🎉 Goal Completed",
                    "message": f"Congratulations! Your '{goal_title}' goal has been completed ({format_indian_currency(target)} target reached).",
                    "severity": "success",
                    "entity_type": "goal",
                    "entity_id": goal.id,
                    "milestone": 100.0,
                })
            # 75% Milestone
            if progress >= 75.0:
                active_alerts.append({
                    "unique_key": f"goal:{goal.id}:milestone:75",
                    "type": "goal_milestone",
                    "title": "🎯 Goal Progress Update",
                    "message": f"Your '{goal_title}' goal has reached 75% progress. Saved {format_indian_currency(saved)} of {format_indian_currency(target)}.",
                    "severity": "info",
                    "entity_type": "goal",
                    "entity_id": goal.id,
                    "milestone": 75.0,
                })
            # 50% Milestone
            if progress >= 50.0:
                active_alerts.append({
                    "unique_key": f"goal:{goal.id}:milestone:50",
                    "type": "goal_milestone",
                    "title": "🎯 Goal Milestone Reached",
                    "message": f"Your '{goal_title}' goal has reached 50% progress. Saved {format_indian_currency(saved)} of {format_indian_currency(target)}.",
                    "severity": "info",
                    "entity_type": "goal",
                    "entity_id": goal.id,
                    "milestone": 50.0,
                })

        # 3. Portfolio Risk & AI Rebalancing evaluation
        from app.api.v1.advisor import TARGET_ALLOCATIONS, _generate_recommendations, _portfolio_risk_level
        from app.api.v1.portfolio import enrich_portfolio_item

        risk_profile = (user.risk_profile or "moderate").lower()
        if hasattr(risk_profile, "value"):
            risk_profile = risk_profile.value.lower()
        target_allocs = TARGET_ALLOCATIONS.get(risk_profile, TARGET_ALLOCATIONS["moderate"])

        holdings = db.query(Portfolio).filter(Portfolio.user_id == user.id, Portfolio.quantity > 0).all()
        enriched_items = [enrich_portfolio_item(h) for h in holdings] if holdings else []

        total_eval_value = 0.0
        total_invested = 0.0
        type_values: Dict[str, float] = {}

        for item in enriched_items:
            asset_type = item.asset_type or "Stock"
            val = item.current_value if item.current_value is not None else (item.total_investment_value or 0.0)
            inv = item.total_investment_value or 0.0
            total_eval_value += val
            total_invested += inv
            type_values[asset_type] = type_values.get(asset_type, 0.0) + val

        current_pcts: Dict[str, float] = {}
        if total_eval_value > 0:
            for at, v in type_values.items():
                current_pcts[at] = (v / total_eval_value) * 100.0

        portfolio_risk = _portfolio_risk_level(current_pcts) if total_eval_value > 0 else risk_profile
        recommendations = _generate_recommendations(risk_profile, current_pcts, target_allocs) if total_eval_value > 0 else []
        needs_rebalancing = (portfolio_risk != risk_profile) or (len(recommendations) > 0)

        if needs_rebalancing and recommendations:
            top_rec = recommendations[0]
            diff_abs = abs(top_rec['difference_pp'])
            
            # Action suggestion
            if top_rec['asset_type'].lower() in ["stock", "equity"] and top_rec['difference_pp'] > 0:
                action_text = "Consider shifting exposure to Debt/Fixed Income."
            elif top_rec['difference_pp'] > 0:
                action_text = f"Consider reducing {top_rec['asset_type']} exposure."
            else:
                action_text = f"Consider increasing {top_rec['asset_type']} exposure."

            # Canonical AI Rebalancing message
            message = (
                f"Your {risk_profile.capitalize()}-risk portfolio has {top_rec['current_pct']:.1f}% "
                f"{top_rec['asset_type']} allocation versus the recommended {top_rec['target_pct']:.1f}% target. "
                f"{action_text}"
            )

            active_alerts.append({
                "unique_key": "portfolio:rebalance",
                "type": "portfolio_risk",
                "title": "⚠️ AI Rebalancing Recommended",
                "message": message,
                "severity": "warning" if diff_abs < 20 else "critical",
                "entity_type": "portfolio",
                "entity_id": user.id,
                "milestone": None,
            })

        # 4. Portfolio Profit / Loss Drawdown Alert
        if total_invested > 0:
            total_pnl = total_eval_value - total_invested
            pnl_pct = (total_pnl / total_invested) * 100.0
            if pnl_pct <= -10.0:
                active_alerts.append({
                    "unique_key": "portfolio:pnl_drawdown",
                    "type": "portfolio_pnl",
                    "title": "📉 Portfolio Performance Alert",
                    "message": f"Your portfolio is currently down {abs(pnl_pct):.1f}%. Review your portfolio allocation and risk exposure.",
                    "severity": "critical" if pnl_pct <= -20.0 else "warning",
                    "entity_type": "portfolio",
                    "entity_id": user.id,
                    "milestone": None,
                })

        # 5. Portfolio Value Growth Milestones
        thresholds = [10000000.0, 5000000.0, 2500000.0, 1000000.0]
        crossed_threshold = None
        for t in thresholds:
            if total_eval_value >= t:
                crossed_threshold = t
                break

        if crossed_threshold is not None:
            active_alerts.append({
                "unique_key": f"portfolio:growth:{int(crossed_threshold)}",
                "type": "portfolio_milestone",
                "title": "📈 Portfolio Growth Milestone",
                "message": f"Your total portfolio value has crossed {format_indian_currency(crossed_threshold)}. Check your asset breakdown.",
                "severity": "success",
                "entity_type": "portfolio",
                "entity_id": user.id,
                "milestone": crossed_threshold,
            })

        # 6. Sync with PostgreSQL Notifications Table
        db_notifications = db.query(Notification).filter(Notification.user_id == user.id).all()
        db_by_key = {n.unique_key: n for n in db_notifications}
        active_keys = {a["unique_key"] for a in active_alerts}

        # Legacy duplicate keys to remove
        legacy_duplicate_keys = {
            "portfolio-moderate-equity-alert",
            "security-session",
            "kyc-alert",
        }
        for leg_key in legacy_duplicate_keys:
            if leg_key in db_by_key:
                db.delete(db_by_key[leg_key])

        # Dynamic keys that should be removed if condition is resolved/balanced
        dynamic_keys_prefix = {"kyc:pending", "portfolio:rebalance", "portfolio:pnl_drawdown"}

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
                    is_active=True,
                    entity_type=a.get("entity_type"),
                    entity_id=a.get("entity_id"),
                    milestone=a.get("milestone"),
                    unique_key=key,
                )
                db.add(new_n)
            else:
                existing_n = db_by_key[key]
                existing_n.title = a["title"]
                existing_n.message = a["message"]
                existing_n.severity = a["severity"]
                existing_n.is_active = True
                existing_n.updated_at = func.now()

        # Remove resolved dynamic warnings
        for key, n in db_by_key.items():
            if key in dynamic_keys_prefix and key not in active_keys:
                db.delete(n)

        db.commit()

        # Fetch finalized active list sorted by created_at desc
        return db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_active == True
        ).order_by(Notification.created_at.desc()).all()

    @classmethod
    def get_user_notifications(cls, db: Session, user: User) -> List[Notification]:
        """
        Read-only query of user's active notifications. Does NOT perform any writes/commits.
        """
        return db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_active == True
        ).order_by(Notification.created_at.desc()).all()

    @classmethod
    def generate_and_get_notifications(cls, db: Session, user: User) -> List[Notification]:
        return cls.evaluate_user_alerts(db, user)

    @classmethod
    def record_security_event(
        cls,
        db: Session,
        user: User,
        title: str = "🔐 Security Status",
        message: str = "Your current account session is active and secure.",
        event_key: Optional[str] = None
    ) -> Optional[Notification]:
        """
        Record an idempotent security notification for a genuine security event (e.g. login).
        """
        key = event_key or "security:session"
        existing = db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.unique_key == key
        ).first()

        if existing:
            existing.title = title
            existing.message = message
            existing.is_active = True
            existing.updated_at = func.now()
            db.commit()
            return existing

        new_n = Notification(
            user_id=user.id,
            type="security",
            title=title,
            message=message,
            severity="info",
            is_read=False,
            is_active=True,
            entity_type="user",
            entity_id=user.id,
            unique_key=key,
        )
        db.add(new_n)
        db.commit()
        db.refresh(new_n)
        return new_n

    @classmethod
    def broadcast_user_notifications(cls, db: Session, user_id: int):
        """
        Broadcast current user notifications state (without re-evaluating rules) to user's active client streams.
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        notifications = cls.get_user_notifications(db, user)
        unread_count = sum(1 for n in notifications if not n.is_read)

        serialized = [
            {
                "id": n.id,
                "user_id": n.user_id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "severity": n.severity,
                "is_read": n.is_read,
                "is_active": n.is_active,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "milestone": n.milestone,
                "created_at": n.created_at.isoformat() if n.created_at else datetime.now().isoformat(),
                "unique_key": n.unique_key,
            }
            for n in notifications
        ]

        payload = {
            "notifications": serialized,
            "unread_count": unread_count,
            "timestamp": datetime.now().isoformat(),
        }

        notification_stream_manager.dispatch_to_user(user_id, "notification_update", payload)

    @classmethod
    def evaluate_and_broadcast(cls, db: Session, user_id: int):
        """
        Evaluate user alerts and broadcast real-time SSE event to user's active client streams.
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        notifications = cls.evaluate_user_alerts(db, user)
        unread_count = sum(1 for n in notifications if not n.is_read)

        serialized = [
            {
                "id": n.id,
                "user_id": n.user_id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "severity": n.severity,
                "is_read": n.is_read,
                "is_active": n.is_active,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "milestone": n.milestone,
                "created_at": n.created_at.isoformat() if n.created_at else datetime.now().isoformat(),
                "unique_key": n.unique_key,
            }
            for n in notifications
        ]

        payload = {
            "notifications": serialized,
            "unread_count": unread_count,
            "timestamp": datetime.now().isoformat(),
        }

        notification_stream_manager.dispatch_to_user(user_id, "notification_update", payload)

    @staticmethod
    def mark_all_as_read(db: Session, user: User) -> int:
        count = db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_read == False
        ).update({"is_read": True}, synchronize_session="fetch")
        db.commit()
        return count

    @staticmethod
    def mark_as_read(db: Session, user: User, notification_id: int) -> Optional[Notification]:
        n = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user.id
        ).first()
        if n and not n.is_read:
            n.is_read = True
            db.commit()
            db.refresh(n)
        return n

    @staticmethod
    def delete_notification(db: Session, user: User, notification_id: int) -> bool:
        n = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user.id
        ).first()
        if n:
            db.delete(n)
            db.commit()
            return True
        return False

    @staticmethod
    def get_unread_count(db: Session, user: User) -> int:
        return db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_read == False,
            Notification.is_active == True
        ).count()
