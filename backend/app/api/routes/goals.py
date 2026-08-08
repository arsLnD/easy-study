"""Роуты финансовых целей и пополнений (вкладов) в них."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.goal import Goal, GoalContribution, GoalStatus
from app.models.user import User
from app.schemas.goal import (
    GoalContributionCreate,
    GoalContributionRead,
    GoalCreate,
    GoalRead,
    GoalUpdate,
)

router = APIRouter(prefix="/goals", tags=["goals"])


def _to_read_model(goal: Goal) -> GoalRead:
    progress = float(goal.current_amount) / float(goal.target_amount) * 100 if goal.target_amount else 0.0
    data = GoalRead.model_validate(goal)
    data.progress_percent = round(min(progress, 100.0), 1)
    return data


async def _get_owned_goal(goal_id: uuid.UUID, current_user: User, db: AsyncSession) -> Goal:
    result = await db.execute(
        select(Goal).options(selectinload(Goal.contributions)).where(Goal.id == goal_id)
    )
    goal = result.scalar_one_or_none()
    if goal is None or goal.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Цель не найдена")
    return goal


@router.get("", response_model=list[GoalRead])
async def list_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.created_at.desc())
    )
    goals = result.scalars().all()
    return [_to_read_model(g) for g in goals]


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = Goal(user_id=current_user.id, **payload.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return _to_read_model(goal)


@router.patch("/{goal_id}", response_model=GoalRead)
async def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _get_owned_goal(goal_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    await db.commit()
    await db.refresh(goal)
    return _to_read_model(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _get_owned_goal(goal_id, current_user, db)
    await db.delete(goal)
    await db.commit()


@router.post("/{goal_id}/contributions", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def add_contribution(
    goal_id: uuid.UUID,
    payload: GoalContributionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _get_owned_goal(goal_id, current_user, db)
    contribution = GoalContribution(goal_id=goal.id, **payload.model_dump())
    db.add(contribution)

    goal.current_amount = Decimal(goal.current_amount) + payload.amount
    if goal.current_amount >= goal.target_amount and goal.status == GoalStatus.ACTIVE:
        goal.status = GoalStatus.COMPLETED

    await db.commit()
    await db.refresh(goal)
    return _to_read_model(goal)


@router.get("/{goal_id}/contributions", response_model=list[GoalContributionRead])
async def list_contributions(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _get_owned_goal(goal_id, current_user, db)
    return sorted(goal.contributions, key=lambda c: c.contributed_on, reverse=True)


@router.delete("/{goal_id}/contributions/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contribution(
    goal_id: uuid.UUID,
    contribution_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _get_owned_goal(goal_id, current_user, db)
    contribution = next((c for c in goal.contributions if c.id == contribution_id), None)
    if contribution is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пополнение не найдено")

    goal.current_amount = max(Decimal("0"), Decimal(goal.current_amount) - Decimal(contribution.amount))
    if goal.status == GoalStatus.COMPLETED and goal.current_amount < goal.target_amount:
        goal.status = GoalStatus.ACTIVE

    await db.delete(contribution)
    await db.commit()
