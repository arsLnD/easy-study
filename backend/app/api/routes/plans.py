"""
Роуты месячного плана (Главный экран 1 — "Мой план").

PUT /api/plans — создать или полностью пересохранить план на месяц (upsert
по (user_id, month) — если план на этот месяц уже есть, его строки
allocations и goal_contributions заменяются присланными).
GET /api/plans/{month} — получить план на конкретный месяц (месяц в формате
YYYY-MM-01).
POST /api/plans/recommendation — получить рекомендацию по распределению
бюджета (см. app/services/recommendations.py), не сохраняя её.
"""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.goal import Goal, GoalContribution, GoalStatus
from app.models.plan import MonthlyPlan, PlanAllocation
from app.models.user import User
from app.schemas.plan import (
    MonthlyPlanCreate,
    MonthlyPlanRead,
    RecommendationRequest,
    RecommendationResponse,
)
from app.services.recommendations import build_budget_recommendation

router = APIRouter(prefix="/plans", tags=["plans"])

_PLAN_LOAD_OPTIONS = (
    selectinload(MonthlyPlan.allocations).selectinload(PlanAllocation.category),
    selectinload(MonthlyPlan.goal_contributions),
)


@router.post("/recommendation", response_model=RecommendationResponse)
async def get_recommendation(
    payload: RecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await build_budget_recommendation(
        db, current_user.id, payload.total_income, payload.month
    )


@router.get("", response_model=list[MonthlyPlanRead])
async def list_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MonthlyPlan)
        .options(*_PLAN_LOAD_OPTIONS)
        .where(MonthlyPlan.user_id == current_user.id)
        .order_by(MonthlyPlan.month.desc())
    )
    return result.scalars().all()


@router.get("/{month}", response_model=MonthlyPlanRead)
async def get_plan(
    month: date,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    normalized_month = month.replace(day=1)
    result = await db.execute(
        select(MonthlyPlan)
        .options(*_PLAN_LOAD_OPTIONS)
        .where(MonthlyPlan.user_id == current_user.id, MonthlyPlan.month == normalized_month)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "План на этот месяц не найден")
    return plan


@router.put("", response_model=MonthlyPlanRead)
async def upsert_plan(
    payload: MonthlyPlanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    normalized_month = payload.month.replace(day=1)

    result = await db.execute(
        select(MonthlyPlan)
        .options(selectinload(MonthlyPlan.allocations), selectinload(MonthlyPlan.goal_contributions))
        .where(MonthlyPlan.user_id == current_user.id, MonthlyPlan.month == normalized_month)
    )
    plan = result.scalar_one_or_none()

    if plan is None:
        plan = MonthlyPlan(user_id=current_user.id, month=normalized_month)
        db.add(plan)
        await db.flush()

    plan.currency = payload.currency
    plan.total_income = payload.total_income

    # Полностью заменяем строки распределения присланными — проще и надёжнее,
    # чем построчный diff, а план редактируется целиком с фронтенда за раз.
    plan.allocations.clear()

    # Перед удалением старых пополнений целей нужно "откатить" их влияние на
    # goal.current_amount, иначе повторное сохранение плана задвоит прогресс.
    goal_ids_touched = {gc.goal_id for gc in plan.goal_contributions}
    old_amounts_by_goal: dict = {}
    for gc in plan.goal_contributions:
        old_amounts_by_goal[gc.goal_id] = old_amounts_by_goal.get(gc.goal_id, Decimal("0")) + Decimal(gc.amount)
    plan.goal_contributions.clear()
    await db.flush()

    for allocation_input in payload.allocations:
        plan.allocations.append(
            PlanAllocation(
                category_id=allocation_input.category_id,
                planned_amount=allocation_input.planned_amount,
            )
        )

    new_amounts_by_goal: dict = {}
    for contribution_input in payload.goal_contributions:
        if contribution_input.amount <= 0:
            continue
        plan.goal_contributions.append(
            GoalContribution(
                goal_id=contribution_input.goal_id,
                amount=contribution_input.amount,
                contributed_on=normalized_month,
                note="Отчисление по месячному плану",
            )
        )
        new_amounts_by_goal[contribution_input.goal_id] = (
            new_amounts_by_goal.get(contribution_input.goal_id, Decimal("0")) + contribution_input.amount
        )
        goal_ids_touched.add(contribution_input.goal_id)

    if goal_ids_touched:
        goals_result = await db.execute(
            select(Goal).where(Goal.id.in_(goal_ids_touched), Goal.user_id == current_user.id)
        )
        for goal in goals_result.scalars().all():
            delta = new_amounts_by_goal.get(goal.id, Decimal("0")) - old_amounts_by_goal.get(goal.id, Decimal("0"))
            goal.current_amount = max(Decimal("0"), Decimal(goal.current_amount) + delta)
            if goal.current_amount >= goal.target_amount and goal.status == GoalStatus.ACTIVE:
                goal.status = GoalStatus.COMPLETED
            elif goal.current_amount < goal.target_amount and goal.status == GoalStatus.COMPLETED:
                goal.status = GoalStatus.ACTIVE

    await db.commit()

    result = await db.execute(
        select(MonthlyPlan).options(*_PLAN_LOAD_OPTIONS).where(MonthlyPlan.id == plan.id)
    )
    return result.scalar_one()
