from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserProfileResponse, RiskProfileUpdate, KYCStatusUpdate
from app.services.notifications import NotificationService
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserProfileResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/risk-profile", response_model=UserProfileResponse)
def update_risk_profile(
    payload: RiskProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Re-fetch within this request's session to avoid detached-instance errors
    user = db.merge(current_user)
    user.risk_profile = payload.risk_profile
    db.commit()
    db.refresh(user)
    NotificationService.evaluate_and_broadcast(db, user.id)
    return user


@router.patch("/me/kyc-status", response_model=UserProfileResponse)
def update_kyc_status(
    payload: KYCStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # KYC status verification is strictly managed by authorized compliance officers/institutions.
    # Standard users are not permitted to self-certify or modify their own KYC status.
    is_authorized = getattr(current_user, "is_admin", False) or getattr(current_user, "role", None) in ("admin", "compliance_officer")
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Standard users cannot modify their own KYC verification status. KYC verification is managed by compliance administrators.",
        )
    user = db.merge(current_user)
    user.kyc_status = payload.kyc_status
    db.commit()
    db.refresh(user)
    NotificationService.evaluate_and_broadcast(db, user.id)
    return user
