import re
import logging
from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.services.market_service import MarketService, normalize_symbol_for_yahoo

logger = logging.getLogger(__name__)


def get_transaction_sort_key(t: Transaction):
    """
    Deterministic sort key for chronological ledger replay:
    1. Calendar date of transaction
    2. Type priority: BUY & DIVIDEND (0) before SELL & WITHDRAWAL (1) on the same date
    3. Created timestamp or transaction timestamp
    4. Database ID (insertion order)
    """
    t_date = t.transaction_date.date() if hasattr(t.transaction_date, "date") else t.transaction_date
    tx_type = t.transaction_type.value if hasattr(t.transaction_type, "value") else str(t.transaction_type)
    type_priority = 0 if tx_type in ("BUY", "DIVIDEND") else 1
    created = t.created_at or t.transaction_date
    t_id = t.id or 0
    return (t_date, type_priority, created, t_id)


def calculate_available_quantity(
    db: Session,
    user_id: int,
    canonical_symbol: str,
    raw_symbol: Optional[str] = None,
    asset_type: str = "Stock"
) -> float:
    """
    Calculate the exact available quantity of an asset for a user from their transaction history.
    """
    raw_sym = re.sub(r'\s+', '', str(raw_symbol or canonical_symbol or '')).upper()
    canonical_sym = canonical_symbol or normalize_symbol_for_yahoo(raw_sym, asset_type) or raw_sym

    all_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .all()
    )

    matching_txs = [
        t for t in all_txs
        if normalize_symbol_for_yahoo(t.symbol, asset_type) == canonical_sym
        or (t.symbol or "").strip().upper() == raw_sym
        or (t.symbol or "").strip().upper() == canonical_sym
        or (t.symbol and normalize_symbol_for_yahoo(t.symbol, "Stock") == canonical_sym)
    ]

    if not matching_txs:
        # If no transactions exist, check active portfolio holding
        all_holdings = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
        for h in all_holdings:
            h_raw = (h.symbol or "").strip().upper()
            h_norm = (h.normalized_symbol or "").strip().upper() or normalize_symbol_for_yahoo(h_raw, h.asset_type) or h_raw
            if h_norm == canonical_sym or h_raw == raw_sym or h_raw == canonical_sym or normalize_symbol_for_yahoo(h_raw, h.asset_type) == canonical_sym:
                return float(h.quantity) if h.quantity and float(h.quantity) > 0 else 0.0
        return 0.0

    matching_txs.sort(key=get_transaction_sort_key)

    net_quantity = 0.0
    for t in matching_txs:
        tx_type = t.transaction_type.value if hasattr(t.transaction_type, "value") else str(t.transaction_type)
        if tx_type in ("BUY", "DIVIDEND"):
            net_quantity += float(t.quantity or 0.0)
        elif tx_type in ("SELL", "WITHDRAWAL"):
            net_quantity = max(0.0, net_quantity - float(t.quantity or 0.0))

    return round(net_quantity, 4)


def sync_user_holding_from_transactions(
    db: Session,
    user_id: int,
    canonical_symbol: str,
    raw_symbol: Optional[str] = None,
    asset_type: str = "Stock",
    asset_name: Optional[str] = None,
) -> Optional[Portfolio]:
    """
    Synchronize a user's portfolio holding for a specific asset deterministically from their transaction ledger.
    Uses the Weighted-Average Cost Basis Method:
    - BUY: new_avg = (existing_qty * existing_avg + buy_qty * buy_price) / (existing_qty + buy_qty)
    - SELL: remaining_qty = existing_qty - sell_qty; average_buy_price remains unchanged.
    - If remaining_qty == 0: holding record is removed from Portfolio while transactions remain preserved.
    """
    raw_sym = re.sub(r'\s+', '', str(raw_symbol or canonical_symbol or '')).upper()
    canonical_sym = canonical_symbol or normalize_symbol_for_yahoo(raw_sym, asset_type) or raw_sym

    # 1. Fetch all transactions for this user & symbol
    all_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .all()
    )

    matching_txs = [
        t for t in all_txs
        if normalize_symbol_for_yahoo(t.symbol, asset_type) == canonical_sym
        or (t.symbol or "").strip().upper() == raw_sym
        or (t.symbol or "").strip().upper() == canonical_sym
        or (t.symbol and normalize_symbol_for_yahoo(t.symbol, "Stock") == canonical_sym)
    ]

    matching_txs.sort(key=get_transaction_sort_key)

    # 2. Replay transactions to calculate net quantity and weighted average buy price
    net_quantity = 0.0
    running_avg_price = 0.0

    for t in matching_txs:
        tx_type = t.transaction_type.value if hasattr(t.transaction_type, "value") else str(t.transaction_type)
        qty = float(t.quantity or 0.0)
        prc = float(t.price or 0.0)

        if tx_type in ("BUY", "DIVIDEND"):
            new_qty = net_quantity + qty
            if new_qty > 0:
                running_avg_price = ((net_quantity * running_avg_price) + (qty * prc)) / new_qty
            net_quantity = new_qty
        elif tx_type in ("SELL", "WITHDRAWAL"):
            net_quantity = max(0.0, net_quantity - qty)
            if net_quantity <= 1e-6:
                running_avg_price = 0.0
            # On partial SELL, running_avg_price stays unchanged (weighted-average method)

    # 3. Locate existing holding records in the database
    all_holdings = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
    existing_holdings = [
        h for h in all_holdings
        if (h.symbol or "").strip().upper() == canonical_sym
        or (h.normalized_symbol or "").strip().upper() == canonical_sym
        or (h.symbol or "").strip().upper() == raw_sym
        or normalize_symbol_for_yahoo(h.symbol, h.asset_type) == canonical_sym
    ]

    # 4. Update or remove portfolio holding
    if net_quantity > 1e-6:
        primary = None
        if existing_holdings:
            primary = existing_holdings[0]
            for extra in existing_holdings[1:]:
                db.delete(extra)
        else:
            final_name = asset_name
            if not final_name:
                try:
                    quote = MarketService.get_quote(canonical_sym, asset_type=asset_type)
                    final_name = quote.get("name", f"{canonical_sym or raw_sym} Asset")
                except Exception:
                    final_name = f"{canonical_sym or raw_sym} Asset"

            primary = Portfolio(
                user_id=user_id,
                symbol=canonical_sym or raw_sym,
                normalized_symbol=canonical_sym if asset_type.lower() not in ["bond", "cash", "fixed deposit", "fd"] else "",
                asset_name=final_name,
                asset_type=asset_type,
                quantity=0.0,
                average_buy_price=0.0,
            )
            db.add(primary)
            db.flush()  # assign primary.id

        primary.quantity = round(net_quantity, 4)
        primary.average_buy_price = round(running_avg_price, 4)
        primary.symbol = canonical_sym or primary.symbol
        if asset_type.lower() not in ["bond", "cash", "fixed deposit", "fd"]:
            primary.normalized_symbol = canonical_sym
        if asset_name and not primary.asset_name:
            primary.asset_name = asset_name
        if asset_type:
            primary.asset_type = asset_type

        # Associate transactions with holding
        for t in matching_txs:
            t.portfolio_id = primary.id

        return primary

    else:
        # All shares sold / 0 quantity -> Cleanly remove holding from active portfolio
        for h in existing_holdings:
            db.delete(h)
        for t in matching_txs:
            t.portfolio_id = None

        return None


def reconcile_all_user_holdings(db: Session, user_id: int):
    """
    Reconcile all portfolio holdings for a user against their transaction records.
    Purges any 0-quantity ghost holdings and resolves duplicates.
    """
    try:
        # 1. Distinct symbols from transactions
        user_tx_symbols = [
            r[0] for r in db.query(Transaction.symbol)
            .filter(Transaction.user_id == user_id)
            .distinct()
            .all()
            if r[0]
        ]

        synced_symbols = set()
        for sym in user_tx_symbols:
            raw_sym = sym.strip().upper()
            # Determine asset type if possible from existing holdings
            matching_h = db.query(Portfolio).filter(
                Portfolio.user_id == user_id,
                (Portfolio.symbol == raw_sym) | (Portfolio.normalized_symbol == raw_sym)
            ).first()
            asset_type = matching_h.asset_type if matching_h else ("Mutual Fund" if "BALANCED" in raw_sym or "FUND" in raw_sym else "Stock")
            canonical = normalize_symbol_for_yahoo(raw_sym, asset_type) or raw_sym
            if canonical not in synced_symbols:
                sync_user_holding_from_transactions(db, user_id, canonical, raw_sym, asset_type=asset_type)
                synced_symbols.add(canonical)
                synced_symbols.add(raw_sym)

        # 2. Holdings cleanup
        holdings = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
        for h in holdings:
            raw_h_sym = (h.symbol or "").strip().upper()
            canonical_h = h.normalized_symbol or normalize_symbol_for_yahoo(raw_h_sym, h.asset_type) or raw_h_sym

            # If holding has 0 or negative quantity, delete it
            if float(h.quantity or 0.0) <= 1e-6:
                db.delete(h)
                continue

            # If holding was not synced via transactions, check if transactions exist
            if canonical_h not in synced_symbols and raw_h_sym not in synced_symbols:
                tx_count = (
                    db.query(Transaction)
                    .filter(
                        Transaction.user_id == user_id,
                        (Transaction.symbol == canonical_h) | (Transaction.symbol == raw_h_sym)
                    )
                    .count()
                )
                if tx_count > 0:
                    sync_user_holding_from_transactions(db, user_id, canonical_h, raw_h_sym, h.asset_type, h.asset_name)
                    synced_symbols.add(canonical_h)
                else:
                    # Holding exists without transaction -> create baseline BUY transaction so ledger stays synced
                    base_tx = Transaction(
                        user_id=user_id,
                        portfolio_id=h.id,
                        symbol=canonical_h or h.symbol,
                        transaction_type=TransactionTypeEnum.BUY,
                        quantity=float(h.quantity),
                        price=float(h.average_buy_price),
                        amount=round(float(h.quantity) * float(h.average_buy_price), 2),
                        notes="Initial portfolio holding entry",
                    )
                    db.add(base_tx)
                    synced_symbols.add(canonical_h)

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to reconcile holdings for user {user_id}: {e}", exc_info=True)

