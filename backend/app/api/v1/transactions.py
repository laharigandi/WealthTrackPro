from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.market_service import MarketService, normalize_symbol_for_yahoo
from app.services.portfolio_calc import (
    calculate_available_quantity,
    sync_user_holding_from_transactions,
    get_transaction_sort_key,
)
from app.services.notifications import NotificationService
from app.api.deps import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=List[TransactionResponse])
def get_user_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
        .all()
    )
    return txs


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    tx_in: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    symbol_raw = (tx_in.symbol or "").strip().upper()
    asset_type = (tx_in.asset_type or "Stock").strip()
    canonical_symbol = normalize_symbol_for_yahoo(symbol_raw, asset_type) or symbol_raw
    total_amount = round(tx_in.quantity * tx_in.price, 2)
    tx_date = tx_in.transaction_date or datetime.now()

    tx_type_str = tx_in.transaction_type.value if hasattr(tx_in.transaction_type, "value") else str(tx_in.transaction_type)

    # Validate SELL transactions against available quantity
    if tx_type_str == "SELL":
        if tx_in.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Requested sell quantity must be greater than 0."
            )
        avail_qty = calculate_available_quantity(db, current_user.id, canonical_symbol, symbol_raw, asset_type=asset_type)
        if tx_in.quantity > avail_qty + 1e-6:
            avail_display = 0 if avail_qty <= 1e-6 else (int(avail_qty) if avail_qty.is_integer() else round(avail_qty, 4))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot sell {tx_in.quantity} {symbol_raw or canonical_symbol}. Available quantity: {avail_display}.",
            )

    try:
        new_tx = Transaction(
            user_id=current_user.id,
            portfolio_id=None,
            symbol=canonical_symbol or symbol_raw,
            transaction_type=tx_in.transaction_type,
            quantity=tx_in.quantity,
            price=tx_in.price,
            amount=total_amount,
            transaction_date=tx_date,
            notes=tx_in.notes,
        )
        db.add(new_tx)
        db.flush()

        holding = sync_user_holding_from_transactions(
            db=db,
            user_id=current_user.id,
            canonical_symbol=canonical_symbol,
            raw_symbol=symbol_raw,
            asset_type=asset_type,
            asset_name=tx_in.asset_name,
        )

        if holding:
            new_tx.portfolio_id = holding.id

        db.commit()
        db.refresh(new_tx)
        NotificationService.evaluate_and_broadcast(db, current_user.id)
        return new_tx
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record transaction: {str(e)}"
        )


@router.get("/{id}", response_model=TransactionResponse)
def get_transaction_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == current_user.id).first()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction record not found.")
    return tx


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def delete_transaction(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == current_user.id).first()
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction record not found or does not belong to you."
        )

    symbol_raw = (tx.symbol or "").strip().upper()
    canonical_symbol = normalize_symbol_for_yahoo(symbol_raw) or symbol_raw

    # 1. Find all remaining transactions for this user & symbol excluding this transaction
    all_user_txs = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.id != id,
        )
        .all()
    )

    remaining_txs = [
        t for t in all_user_txs
        if normalize_symbol_for_yahoo(t.symbol) == canonical_symbol
        or (t.symbol or "").strip().upper() == symbol_raw
        or (t.symbol or "").strip().upper() == canonical_symbol
        or (t.symbol and normalize_symbol_for_yahoo(t.symbol, "Stock") == canonical_symbol)
    ]

    remaining_txs.sort(key=get_transaction_sort_key)

    # 2. Chronologically replay remaining transactions to recalculate net holdings and average buy price
    net_quantity = 0.0
    running_avg_price = 0.0

    for t in remaining_txs:
        t_type = t.transaction_type.value if hasattr(t.transaction_type, "value") else str(t.transaction_type)
        if t_type in ("BUY", "DIVIDEND"):
            new_qty = net_quantity + t.quantity
            if new_qty > 0:
                running_avg_price = (
                    (net_quantity * running_avg_price) + (t.quantity * t.price)
                ) / new_qty
            net_quantity = new_qty
        elif t_type in ("SELL", "WITHDRAWAL"):
            if t.quantity > net_quantity + 1e-6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cannot delete transaction: removing this record would leave subsequent SELL "
                        f"transactions ({t.quantity} shares) exceeding available holdings ({round(net_quantity, 4)} shares)."
                    )
                )
            net_quantity = max(0.0, net_quantity - t.quantity)

    # 3. Update database and recalculate portfolio holding
    try:
        db.delete(tx)
        db.flush()

        sync_user_holding_from_transactions(
            db=db,
            user_id=current_user.id,
            canonical_symbol=canonical_symbol,
            raw_symbol=symbol_raw,
        )

        db.commit()
        NotificationService.evaluate_and_broadcast(db, current_user.id)

        return {
            "message": "Transaction deleted successfully.",
            "deleted_id": id,
            "symbol": canonical_symbol or symbol_raw,
            "remaining_quantity": round(net_quantity, 4),
            "remaining_average_price": round(running_avg_price, 4) if net_quantity > 0 else 0.0,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete transaction and recalculate portfolio: {str(e)}"
        )
