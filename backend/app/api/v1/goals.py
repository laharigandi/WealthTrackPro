import math
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.goal import Goal
from app.schemas.goal import (
    GoalCreate,
    GoalUpdate,
    GoalResponse,
    GoalSimulationRequest,
    GoalSimulationResponse,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/goals", tags=["Goals"])


def calculate_goal_metrics(goal: Goal) -> dict:
    remaining = max(0.0, goal.target_amount - goal.current_amount)
    progress = (
        min(100.0, max(0.0, (goal.current_amount / goal.target_amount) * 100))
        if goal.target_amount > 0
        else 0.0
    )
    return {
        "remaining_amount": round(remaining, 2),
        "progress_percentage": round(progress, 2),
    }


@router.get("", response_model=List[GoalResponse])
def get_user_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = db.query(Goal).filter(Goal.user_id == current_user.id).order_by(Goal.created_at.desc()).all()
    res = []
    for g in goals:
        metrics = calculate_goal_metrics(g)
        res.append(
            GoalResponse(
                id=g.id,
                user_id=g.user_id,
                title=g.title,
                category=g.category,
                target_amount=g.target_amount,
                current_amount=g.current_amount,
                monthly_contribution=g.monthly_contribution,
                target_date=g.target_date,
                expected_return_rate=g.expected_return_rate,
                remaining_amount=metrics["remaining_amount"],
                progress_percentage=metrics["progress_percentage"],
                created_at=g.created_at,
                updated_at=g.updated_at,
            )
        )
    return res


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    goal_in: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_goal = Goal(
        user_id=current_user.id,
        title=goal_in.title,
        category=goal_in.category,
        target_amount=goal_in.target_amount,
        current_amount=goal_in.current_amount,
        monthly_contribution=goal_in.monthly_contribution,
        target_date=goal_in.target_date,
        expected_return_rate=goal_in.expected_return_rate,
    )
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)

    metrics = calculate_goal_metrics(new_goal)
    return GoalResponse(
        id=new_goal.id,
        user_id=new_goal.user_id,
        title=new_goal.title,
        category=new_goal.category,
        target_amount=new_goal.target_amount,
        current_amount=new_goal.current_amount,
        monthly_contribution=new_goal.monthly_contribution,
        target_date=new_goal.target_date,
        expected_return_rate=new_goal.expected_return_rate,
        remaining_amount=metrics["remaining_amount"],
        progress_percentage=metrics["progress_percentage"],
        created_at=new_goal.created_at,
        updated_at=new_goal.updated_at,
    )


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal_by_id(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")
    metrics = calculate_goal_metrics(goal)
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        category=goal.category,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        monthly_contribution=goal.monthly_contribution,
        target_date=goal.target_date,
        expected_return_rate=goal.expected_return_rate,
        remaining_amount=metrics["remaining_amount"],
        progress_percentage=metrics["progress_percentage"],
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


@router.patch("/{goal_id}", response_model=GoalResponse)
@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    goal_in: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")

    update_data = goal_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(goal, field, val)

    db.commit()
    db.refresh(goal)
    metrics = calculate_goal_metrics(goal)
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        category=goal.category,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        monthly_contribution=goal.monthly_contribution,
        target_date=goal.target_date,
        expected_return_rate=goal.expected_return_rate,
        remaining_amount=metrics["remaining_amount"],
        progress_percentage=metrics["progress_percentage"],
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")
    db.delete(goal)
    db.commit()
    return None


@router.post("/{goal_id}/simulate", response_model=GoalSimulationResponse)
def simulate_goal(
    goal_id: int,
    sim_in: GoalSimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")

    target_amt = sim_in.target_amount if sim_in.target_amount is not None else goal.target_amount
    curr_amt = sim_in.current_amount if sim_in.current_amount is not None else goal.current_amount
    orig_pmt = goal.monthly_contribution
    sim_pmt = sim_in.monthly_contribution if sim_in.monthly_contribution is not None else orig_pmt
    orig_target_date = goal.target_date
    sim_target_date = sim_in.target_date if sim_in.target_date is not None else orig_target_date
    r_rate = sim_in.expected_return_rate if sim_in.expected_return_rate is not None else goal.expected_return_rate

    # Calculate months between now and sim_target_date
    try:
        t_date = datetime.strptime(sim_target_date, "%Y-%m-%d")
    except ValueError:
        try:
            t_date = datetime.strptime(sim_target_date, "%Y")
        except ValueError:
            t_date = datetime.now()

    now = datetime.now()
    months_left = max(1, (t_date.year - now.year) * 12 + (t_date.month - now.month))
    
    monthly_r = (r_rate / 100.0) / 12.0

    # Calculate Future Value with compound growth
    if monthly_r > 0:
        fv_curr = curr_amt * math.pow(1 + monthly_r, months_left)
        fv_pmt = sim_pmt * ((math.pow(1 + monthly_r, months_left) - 1) / monthly_r)
        future_val = fv_curr + fv_pmt
    else:
        future_val = curr_amt + (sim_pmt * months_left)

    # Calculate required monthly contribution to hit target_amt at target_date
    remaining_needed = target_amt - (curr_amt * (math.pow(1 + monthly_r, months_left) if monthly_r > 0 else 1.0))
    if remaining_needed <= 0:
        req_pmt = 0.0
    elif monthly_r > 0:
        req_pmt = remaining_needed * monthly_r / (math.pow(1 + monthly_r, months_left) - 1)
    else:
        req_pmt = remaining_needed / months_left

    remaining_amt = max(0.0, target_amt - curr_amt)
    orig_prog = min(100.0, max(0.0, (curr_amt / target_amt) * 100)) if target_amt > 0 else 0.0
    sim_prog = min(100.0, max(0.0, (future_val / target_amt) * 100)) if target_amt > 0 else 0.0

    return GoalSimulationResponse(
        goal_id=goal.id,
        target_amount=round(target_amt, 2),
        current_amount=round(curr_amt, 2),
        remaining_amount=round(remaining_amt, 2),
        progress_percentage=round(orig_prog, 2),
        original_monthly_contribution=round(orig_pmt, 2),
        simulated_monthly_contribution=round(sim_pmt, 2),
        original_target_date=orig_target_date,
        simulated_target_date=sim_target_date,
        expected_return_rate=r_rate,
        total_months_required=months_left,
        estimated_completion_date=sim_target_date,
        estimated_total_future_value=round(future_val, 2),
        required_monthly_contribution=round(max(0.0, req_pmt), 2),
        is_on_track=future_val >= target_amt,
    )
