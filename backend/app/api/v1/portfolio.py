from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.portfolio import Portfolio
from app.schemas.portfolio import PortfolioCreate, PortfolioUpdate, PortfolioResponse
from app.services.market_service import MarketService
from app.api.deps import get_current_user

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


def enrich_portfolio_item(item: Portfolio) -> PortfolioResponse:
    quote = MarketService.get_quote(item.symbol)
    curr_price = float(quote.get("price", item.average_buy_price))
    total_inv = item.quantity * item.average_buy_price
    curr_val = item.quantity * curr_price
    pnl = curr_val - total_inv
    pnl_pct = (pnl / total_inv * 100.0) if total_inv > 0 else 0.0

    return PortfolioResponse(
        id=item.id,
        user_id=item.user_id,
        symbol=item.symbol,
        asset_name=item.asset_name,
        asset_type=item.asset_type,
        quantity=item.quantity,
        average_buy_price=item.average_buy_price,
        current_price=round(curr_price, 2),
        total_investment_value=round(total_inv, 2),
        current_value=round(curr_val, 2),
        profit_loss=round(pnl, 2),
        profit_loss_percentage=round(pnl_pct, 2),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=List[PortfolioResponse])
def get_user_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).order_by(Portfolio.symbol.asc()).all()
    return [enrich_portfolio_item(i) for i in items]


@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio_item(
    item_in: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.symbol == item_in.symbol.upper())
        .first()
    )
    if existing:
        # Merge quantities and recalculate avg buy price
        tot_qty = existing.quantity + item_in.quantity
        if tot_qty > 0:
            existing.average_buy_price = (
                (existing.quantity * existing.average_buy_price)
                + (item_in.quantity * item_in.average_buy_price)
            ) / tot_qty
            existing.quantity = tot_qty
        existing.asset_name = item_in.asset_name or existing.asset_name
        existing.asset_type = item_in.asset_type or existing.asset_type
        db.commit()
        db.refresh(existing)
        return enrich_portfolio_item(existing)

    new_item = Portfolio(
        user_id=current_user.id,
        symbol=item_in.symbol.upper(),
        asset_name=item_in.asset_name,
        asset_type=item_in.asset_type,
        quantity=item_in.quantity,
        average_buy_price=item_in.average_buy_price,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return enrich_portfolio_item(new_item)


@router.get("/{id}", response_model=PortfolioResponse)
def get_portfolio_item(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio holding not found.")
    return enrich_portfolio_item(item)


@router.patch("/{id}", response_model=PortfolioResponse)
@router.put("/{id}", response_model=PortfolioResponse)
def update_portfolio_item(
    id: int,
    item_in: PortfolioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio holding not found.")

    update_data = item_in.model_dump(exclude_unset=True)
    if "symbol" in update_data and update_data["symbol"]:
        update_data["symbol"] = update_data["symbol"].upper()

    for field, val in update_data.items():
        setattr(item, field, val)

    db.commit()
    db.refresh(item)
    return enrich_portfolio_item(item)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_item(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio holding not found.")
    db.delete(item)
    db.commit()
    return None
