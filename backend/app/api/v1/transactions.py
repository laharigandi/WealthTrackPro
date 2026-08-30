from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.market_service import MarketService
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
        .order_by(Transaction.transaction_date.desc())
        .all()
    )
    return txs


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    tx_in: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    symbol_upper = tx_in.symbol.upper()
    total_amount = round(tx_in.quantity * tx_in.price, 2)
    tx_date = tx_in.transaction_date or datetime.now()

    holding = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.symbol == symbol_upper)
        .first()
    )

    if tx_in.transaction_type == TransactionTypeEnum.BUY:
        asset_name = tx_in.asset_name
        if not asset_name:
            quote = MarketService.get_quote(symbol_upper)
            asset_name = quote.get("name", f"{symbol_upper} Asset")

        if holding:
            tot_qty = holding.quantity + tx_in.quantity
            if tot_qty > 0:
                holding.average_buy_price = (
                    (holding.quantity * holding.average_buy_price)
                    + (tx_in.quantity * tx_in.price)
                ) / tot_qty
                holding.quantity = tot_qty
            if tx_in.asset_name:
                holding.asset_name = tx_in.asset_name
        else:
            holding = Portfolio(
                user_id=current_user.id,
                symbol=symbol_upper,
                asset_name=asset_name,
                asset_type=tx_in.asset_type or "Stock",
                quantity=tx_in.quantity,
                average_buy_price=tx_in.price,
            )
            db.add(holding)
            db.flush()  # assign holding.id

    elif tx_in.transaction_type == TransactionTypeEnum.SELL:
        if not holding or holding.quantity < tx_in.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient portfolio quantity to sell {symbol_upper}. Current holdings: {holding.quantity if holding else 0}.",
            )
        holding.quantity -= tx_in.quantity

    new_tx = Transaction(
        user_id=current_user.id,
        portfolio_id=holding.id if holding else None,
        symbol=symbol_upper,
        transaction_type=tx_in.transaction_type,
        quantity=tx_in.quantity,
        price=tx_in.price,
        amount=total_amount,
        transaction_date=tx_date,
        notes=tx_in.notes,
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)

    return new_tx


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
