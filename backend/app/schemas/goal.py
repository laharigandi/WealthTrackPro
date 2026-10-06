from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from datetime import datetime
from typing import Optional, Any
import math

class GoalBase(BaseModel):
    title: str = Field(..., json_schema_extra={"example": "Buy House"})
    category: str = Field("Custom Goal", json_schema_extra={"example": "House"})
    target_amount: float = Field(..., gt=0, json_schema_extra={"example": 5000000.0})
    current_amount: float = Field(0.0, ge=0, json_schema_extra={"example": 500000.0})
    monthly_contribution: float = Field(0.0, ge=0, json_schema_extra={"example": 20000.0})
    target_date: str = Field(..., json_schema_extra={"example": "2036-12-31"})
    expected_return_rate: float = Field(8.0, ge=0, le=100, json_schema_extra={"example": 10.0})  # annual %
    description: Optional[str] = Field(None, json_schema_extra={"example": "Saving for a dream home"})

    @model_validator(mode="before")
    @classmethod
    def map_field_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # map goal_name -> title
            if "goal_name" in data and "title" not in data:
                data["title"] = data["goal_name"]
            # map goal_type -> category
            if "goal_type" in data and "category" not in data:
                data["category"] = data["goal_type"]
            # map current_saved -> current_amount
            if "current_saved" in data and "current_amount" not in data:
                data["current_amount"] = data["current_saved"]
            # map monthly_investment -> monthly_contribution
            if "monthly_investment" in data and "monthly_contribution" not in data:
                data["monthly_contribution"] = data["monthly_investment"]
        return data

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Goal title is required.")
        return str(v).strip()

    @field_validator("target_amount")
    @classmethod
    def validate_target_amount(cls, v):
        if v is None:
            raise ValueError("Target amount is required.")
        if math.isnan(v) or math.isinf(v):
            raise ValueError("Target amount must be a finite number.")
        if v <= 0:
            raise ValueError("Target amount must be greater than zero.")
        return float(v)

    @field_validator("current_amount", "monthly_contribution", "expected_return_rate")
    @classmethod
    def validate_numeric(cls, v):
        if v is not None:
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Value must be a finite number.")
        return v

    @field_validator("target_date")
    @classmethod
    def validate_target_date(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Target date cannot be empty.")
        v_str = str(v).strip()
        try:
            t_date = datetime.strptime(v_str, "%Y-%m-%d")
        except ValueError:
            try:
                t_date = datetime.strptime(f"{v_str}-12-31", "%Y-%m-%d")
            except ValueError:
                raise ValueError("Target date must be in YYYY-MM-DD format.")
        
        now = datetime.now()
        if t_date.date() < now.date():
            raise ValueError("Target date cannot be in the past.")
        return t_date.strftime("%Y-%m-%d")

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
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def map_field_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "goal_name" in data and "title" not in data:
                data["title"] = data["goal_name"]
            if "goal_type" in data and "category" not in data:
                data["category"] = data["goal_type"]
            if "current_saved" in data and "current_amount" not in data:
                data["current_amount"] = data["current_saved"]
            if "monthly_investment" in data and "monthly_contribution" not in data:
                data["monthly_contribution"] = data["monthly_investment"]
        return data

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        if v is not None:
            if not str(v).strip():
                raise ValueError("Goal title cannot be empty.")
            return str(v).strip()
        return v

    @field_validator("target_amount")
    @classmethod
    def validate_target_amount(cls, v):
        if v is not None:
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Target amount must be a finite number.")
            if v <= 0:
                raise ValueError("Target amount must be greater than zero.")
            return float(v)
        return v

    @field_validator("current_amount", "monthly_contribution", "expected_return_rate")
    @classmethod
    def validate_numeric(cls, v):
        if v is not None:
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Value must be a finite number.")
        return v

    @field_validator("target_date")
    @classmethod
    def validate_target_date(cls, v):
        if v is not None:
            if not str(v).strip():
                raise ValueError("Target date cannot be empty.")
            v_str = str(v).strip()
            try:
                t_date = datetime.strptime(v_str, "%Y-%m-%d")
            except ValueError:
                try:
                    t_date = datetime.strptime(f"{v_str}-12-31", "%Y-%m-%d")
                except ValueError:
                    raise ValueError("Target date must be in YYYY-MM-DD format.")
            
            now = datetime.now()
            if t_date.date() < now.date():
                raise ValueError("Target date cannot be in the past.")
            return t_date.strftime("%Y-%m-%d")
        return v

class GoalResponse(GoalBase):
    id: int
    user_id: int
    remaining_amount: float
    progress_percentage: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GoalSimulationRequest(BaseModel):
    monthly_contribution: Optional[float] = Field(None, ge=0)
    target_date: Optional[str] = None
    expected_return_rate: Optional[float] = Field(None, ge=0, le=100)
    target_amount: Optional[float] = Field(None, gt=0)
    current_amount: Optional[float] = Field(None, ge=0)

    @field_validator("target_amount", "current_amount", "monthly_contribution", "expected_return_rate")
    @classmethod
    def validate_numeric(cls, v):
        if v is not None:
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Value must be a finite number.")
        return v

    @field_validator("target_date")
    @classmethod
    def validate_target_date(cls, v):
        if v is not None:
            if not str(v).strip():
                raise ValueError("Target date cannot be empty.")
            v_str = str(v).strip()
            try:
                t_date = datetime.strptime(v_str, "%Y-%m-%d")
            except ValueError:
                try:
                    t_date = datetime.strptime(f"{v_str}-12-31", "%Y-%m-%d")
                except ValueError:
                    raise ValueError("Target date must be in YYYY-MM-DD format.")
            
            now = datetime.now()
            if t_date.date() < now.date():
                raise ValueError("Target date cannot be in the past.")
            return t_date.strftime("%Y-%m-%d")
        return v

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

    # New fields
    simulation_status: str
    projected_surplus: float
