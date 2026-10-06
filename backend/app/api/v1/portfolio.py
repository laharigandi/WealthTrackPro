import logging
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.portfolio import PortfolioCreate, PortfolioUpdate, PortfolioResponse
from app.services.market_service import MarketService, normalize_symbol_for_yahoo
from app.services.notifications import NotificationService
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


def enrich_portfolio_item(item: Portfolio) -> PortfolioResponse:
    symbol_raw = (item.symbol or "").strip().upper()
    asset_type_clean = (item.asset_type or "Stock").strip()
    norm_symbol = item.normalized_symbol or normalize_symbol_for_yahoo(symbol_raw, asset_type_clean)
    display_symbol = item.symbol or norm_symbol

    curr_price = None
    price_source = "LIVE"
    price_status = "Live"
    is_realtime = True

    # 1. Non-market assets (Bond, Fixed Deposit, Cash, or items with no market ticker)
    if asset_type_clean.lower() in ["bond", "fixed deposit", "fd", "cash"] or not norm_symbol:
        if item.manual_price is not None:
            curr_price = float(item.manual_price)
            price_source = "MANUAL"
            price_status = "Manual"
        else:
            curr_price = float(item.average_buy_price or 0.0)
            price_source = "MANUAL"
            price_status = "Manual"
        is_realtime = False
    elif asset_type_clean.lower() in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
        # 2. Mutual Fund assets (no generic NSE live quote)
        if item.manual_price is not None:
            curr_price = float(item.manual_price)
            price_source = "MANUAL"
            price_status = "Manual"
            is_realtime = False
        else:
            curr_price = None
            price_source = "UNAVAILABLE"
            price_status = "Live unavailable"
            is_realtime = False
    else:
        # 3. Market assets (Stock, ETF, Crypto)
        try:
            quote = MarketService.get_quote(norm_symbol, asset_type=asset_type_clean)
            raw_price = quote.get("current_price") or quote.get("price")
            quote_err = quote.get("error")
            if raw_price is not None and isinstance(raw_price, (int, float)) and raw_price > 0 and not quote_err:
                curr_price = float(raw_price)
                price_source = "LIVE"
                price_status = "Live"
                is_realtime = True
            else:
                # Live market data unavailable
                if item.manual_price is not None:
                    curr_price = float(item.manual_price)
                    price_source = "MANUAL"
                    price_status = "Manual"
                    is_realtime = False
                else:
                    curr_price = None
                    price_source = "UNAVAILABLE"
                    price_status = quote_err or "Live price temporarily unavailable"
                    is_realtime = False
        except Exception as e:
            logger.warning(f"Failed to fetch market quote for {norm_symbol}: {e}")
            if item.manual_price is not None:
                curr_price = float(item.manual_price)
                price_source = "MANUAL"
                price_status = "Manual"
                is_realtime = False
            else:
                curr_price = None
                price_source = "UNAVAILABLE"
                price_status = "Live price temporarily unavailable"
                is_realtime = False

    quantity = float(item.quantity or 0.0)
    avg_buy_price = float(item.average_buy_price or 0.0)
    total_inv = quantity * avg_buy_price

    if curr_price is not None:
        curr_val = round(quantity * curr_price, 2)
        pnl = round(curr_val - total_inv, 2)
        pnl_pct = round((pnl / total_inv * 100.0) if total_inv > 0 else 0.0, 2)
        rounded_curr_price = round(curr_price, 2)
    else:
        curr_val = None
        pnl = None
        pnl_pct = None
        rounded_curr_price = None

    return PortfolioResponse(
        id=item.id,
        user_id=item.user_id,
        symbol=display_symbol,
        normalized_symbol=norm_symbol,
        asset_name=item.asset_name,
        asset_type=item.asset_type,
        quantity=quantity,
        average_buy_price=avg_buy_price,
        manual_price=item.manual_price,
        current_price=rounded_curr_price,
        total_investment_value=round(total_inv, 2),
        current_value=curr_val,
        profit_loss=pnl,
        profit_loss_percentage=pnl_pct,
        price_source=price_source,
        price_status=price_status,
        is_realtime=is_realtime,
        last_price_update=item.last_price_update,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=List[PortfolioResponse])
def get_user_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        items = (
            db.query(Portfolio)
            .filter(Portfolio.user_id == current_user.id, Portfolio.quantity > 0)
            .order_by(Portfolio.created_at.desc())
            .all()
        )
        return [enrich_portfolio_item(i) for i in items]
    except Exception as e:
        logger.error(f"Error fetching user portfolio: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve portfolio holdings: {str(e)}"
        )


@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio_item(
    item_in: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    symbol_raw = (item_in.symbol or "").strip().upper()
    asset_type = (item_in.asset_type or "Stock").strip()
    asset_name = (item_in.asset_name or "").strip()

    if not asset_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Asset name is required.",
        )

    # 1. Validation for market-traded assets vs non-market assets
    norm_symbol = ""
    canonical_symbol = ""
    if asset_type.lower() in ["stock", "etf", "crypto"]:
        if not symbol_raw:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Ticker symbol is required for {asset_type} assets.",
            )
        # Validate market symbol against provider
        try:
            quote = MarketService.validate_or_fetch_symbol(symbol_raw, asset_type)
            canonical_symbol = quote.get("normalized_symbol") or quote.get("symbol") or normalize_symbol_for_yahoo(symbol_raw, asset_type)
            norm_symbol = canonical_symbol
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Market validation failed for {symbol_raw}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid market ticker symbol '{symbol_raw}'. Market data could not be retrieved from Yahoo Finance: {str(e)}",
            )
    elif asset_type.lower() in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
        canonical_symbol = normalize_symbol_for_yahoo(symbol_raw, asset_type) or symbol_raw
        norm_symbol = canonical_symbol
    elif asset_type.lower() in ["bond", "fixed deposit", "fd", "cash"]:
        # Bonds do not query market provider
        symbol_raw = symbol_raw or ""
        canonical_symbol = symbol_raw
        norm_symbol = ""

    try:
        # Check if holding already exists for this user by canonical / raw symbol
        if canonical_symbol:
            existing = (
                db.query(Portfolio)
                .filter(
                    Portfolio.user_id == current_user.id,
                    (Portfolio.symbol == canonical_symbol)
                    | (Portfolio.normalized_symbol == canonical_symbol)
                    | (Portfolio.symbol == symbol_raw)
                    | (Portfolio.normalized_symbol == symbol_raw)
                )
                .first()
            )
            if not existing:
                for h in db.query(Portfolio).filter(Portfolio.user_id == current_user.id).all():
                    if normalize_symbol_for_yahoo(h.symbol, h.asset_type) == canonical_symbol or (h.normalized_symbol and normalize_symbol_for_yahoo(h.normalized_symbol, h.asset_type) == canonical_symbol):
                        existing = h
                        break
        else:
            existing = (
                db.query(Portfolio)
                .filter(
                    Portfolio.user_id == current_user.id,
                    Portfolio.symbol == "",
                    Portfolio.asset_name == asset_name,
                    Portfolio.asset_type == asset_type,
                )
                .first()
            )

        if existing:
            tot_qty = existing.quantity + item_in.quantity
            if tot_qty > 0:
                existing.average_buy_price = (
                    (existing.quantity * existing.average_buy_price)
                    + (item_in.quantity * item_in.average_buy_price)
                ) / tot_qty
                existing.quantity = tot_qty
            existing.symbol = symbol_raw or canonical_symbol or existing.symbol
            existing.normalized_symbol = norm_symbol or canonical_symbol or existing.normalized_symbol
            existing.asset_name = asset_name or existing.asset_name
            existing.asset_type = asset_type or existing.asset_type
            if item_in.manual_price is not None:
                existing.manual_price = item_in.manual_price
            
            if item_in.quantity > 0:
                tx = Transaction(
                    user_id=current_user.id,
                    portfolio_id=existing.id,
                    symbol=canonical_symbol or existing.symbol,
                    transaction_type=TransactionTypeEnum.BUY,
                    quantity=item_in.quantity,
                    price=item_in.average_buy_price,
                    amount=round(item_in.quantity * item_in.average_buy_price, 2),
                    transaction_date=datetime.now(),
                    notes="Additional holding entry",
                )
                db.add(tx)
            
            db.commit()
            db.refresh(existing)
            NotificationService.evaluate_and_broadcast(db, current_user.id)
            return enrich_portfolio_item(existing)

        new_item = Portfolio(
            user_id=current_user.id,
            symbol=symbol_raw or canonical_symbol,
            normalized_symbol=norm_symbol or canonical_symbol,
            asset_name=asset_name,
            asset_type=asset_type,
            quantity=item_in.quantity,
            average_buy_price=item_in.average_buy_price,
            manual_price=item_in.manual_price,
        )
        db.add(new_item)
        db.flush()

        if item_in.quantity > 0:
            tx = Transaction(
                user_id=current_user.id,
                portfolio_id=new_item.id,
                symbol=canonical_symbol or new_item.symbol,
                transaction_type=TransactionTypeEnum.BUY,
                quantity=item_in.quantity,
                price=item_in.average_buy_price,
                amount=round(item_in.quantity * item_in.average_buy_price, 2),
                transaction_date=datetime.now(),
                notes="Initial portfolio holding",
            )
            db.add(tx)

        db.commit()
        db.refresh(new_item)
        NotificationService.evaluate_and_broadcast(db, current_user.id)
        return enrich_portfolio_item(new_item)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating portfolio holding: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while saving holding: {str(e)}",
        )


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
    if "symbol" in update_data:
        update_data["symbol"] = update_data["symbol"].strip().upper() if update_data["symbol"] else ""

    # If updating symbol on market asset, validate and normalize
    target_type = update_data.get("asset_type", item.asset_type)
    target_symbol = update_data.get("symbol", item.symbol)
    if target_type and target_type.lower() in ["stock", "etf", "crypto"] and target_symbol:
        try:
            quote = MarketService.validate_or_fetch_symbol(target_symbol, target_type)
            canonical = quote.get("normalized_symbol") or quote.get("symbol") or normalize_symbol_for_yahoo(target_symbol, target_type)
            update_data["symbol"] = target_symbol
            update_data["normalized_symbol"] = canonical
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid market ticker symbol '{target_symbol}': {str(e)}",
            )
    elif target_type and target_type.lower() in ["mutual fund", "mutual_fund", "mf", "mutualfund"]:
        canonical = normalize_symbol_for_yahoo(target_symbol, target_type) or target_symbol
        update_data["symbol"] = canonical
        update_data["normalized_symbol"] = canonical
    elif target_type and target_type.lower() in ["bond", "fixed deposit", "fd", "cash"]:
        update_data["normalized_symbol"] = ""

    try:
        for field, val in update_data.items():
            setattr(item, field, val)

        db.commit()
        db.refresh(item)
        NotificationService.evaluate_and_broadcast(db, current_user.id)
        return enrich_portfolio_item(item)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating portfolio holding: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while updating holding: {str(e)}",
        )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_item(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio holding not found.")
    try:
        db.query(Transaction).filter(Transaction.portfolio_id == item.id).update({"portfolio_id": None})
        db.delete(item)
        db.commit()
        NotificationService.evaluate_and_broadcast(db, current_user.id)
        return None
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting portfolio holding: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while deleting holding: {str(e)}",
        )
