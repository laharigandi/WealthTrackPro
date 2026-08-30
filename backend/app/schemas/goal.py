from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class GoalBase(BaseModel):
    title: str = Field(..., example="Buy House")
    category: str = Field("Custom Goal", example="House")
    target_amount: float = Field(..., gt=0, example=5000000.0)
    current_amount: float = Field(0.0, ge=0, example=500000.0)
    monthly_contribution: float = Field(0.0, ge=0, example=20000.0)
    target_date: str = Field(..., example="2036-12-31")
    expected_return_rate: float = Field(8.0, ge=0, le=100, example=10.0)  # annual %

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    target_amount: Optional[float] = Field(None, gt=0)
    current_amount: Optional[float] = Field(None, ge=0)
    monthly_contribution: Optional[float] = Field(None, ge=0)
    target_date: Optional[str] = None
    expected_return_rate: Optional[float] = Field(None, ge=0, le=100)

class GoalResponse(GoalBase):
    id: int
    user_id: int
    remaining_amount: float
    progress_percentage: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GoalSimulationRequest(BaseModel):
    monthly_contribution: Optional[float] = Field(None, ge=0)
    target_date: Optional[str] = None
    expected_return_rate: Optional[float] = Field(None, ge=0, le=100)
    target_amount: Optional[float] = Field(None, gt=0)
    current_amount: Optional[float] = Field(None, ge=0)

class GoalSimulationResponse(BaseModel):
    goal_id: Optional[int] = None
    target_amount: float
    current_amount: float
    remaining_amount: float
    progress_percentage: float
    
    # Original vs Simulated
    original_monthly_contribution: float
    simulated_monthly_contribution: float
    original_target_date: str
    simulated_target_date: str
    expected_return_rate: float
    
    # Recalculated outputs
    total_months_required: int
    estimated_completion_date: str
    estimated_total_future_value: float
    required_monthly_contribution: float
    is_on_track: bool
