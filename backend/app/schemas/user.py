from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.user import RiskProfileEnum, KYCStatusEnum

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class RiskProfileUpdate(BaseModel):
    risk_profile: RiskProfileEnum

class KYCStatusUpdate(BaseModel):
    kyc_status: KYCStatusEnum

class UserProfileResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    risk_profile: RiskProfileEnum
    kyc_status: KYCStatusEnum
    created_at: datetime

    class Config:
        from_attributes = True