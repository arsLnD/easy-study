"""
Роуты месячного плана (Главный экран 1 — "Мой план").

PUT /api/plans — создать или полностью пересохранить план на месяц (upsert
по (user_id, month) — если план на этот месяц уже есть, его строки
allocations заменяются присланными). Отчисления на цели — это такие же
строки allocations, но с category_id служебной категории цели (см.
app/models/goal.py) — отдельной логики для них не требуется.
GET /api/plans/{month} — получить план на конкретный месяц (месяц в формате
YYYY-MM-01).
POST /api/plans/recommendation — получить рекомендацию по распределению
бюджета (см. app/services/recommendations.py), не сохраняя её.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
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

_PLAN_LOAD_OPTIONS = (selectinload(MonthlyPlan.allocations).selectinload(PlanAllocation.category),)


@router.post("/recommendation", response_model=RecommendationResponse)
async def get_recommendation(
    payload: RecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    currency = current_user.settings.default_currency if current_user.settings else "RUB"
    return await build_budget_recommendation(
        db, current_user.id, payload.total_income, payload.month, currency
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
        .options(selectinload(MonthlyPlan.allocations))
        .where(MonthlyPlan.user_id == current_user.id, MonthlyPlan.month == normalized_month)
    )
    plan = result.scalar_one_or_none()

    if plan is None:
        # allocations=[] передаём явно при создании — иначе после await
        # db.flush() объект становится "persistent", и обращение к ещё не
        # установленной связи (plan.allocations ниже) вызовет неявный lazy
        # load, а он не поддерживается в асинхронном режиме SQLAlchemy без
        # явного awaitable_attrs (упадёт с MissingGreenlet).
        plan = MonthlyPlan(user_id=current_user.id, month=normalized_month, allocations=[])
        db.add(plan)
        await db.flush()

    plan.currency = payload.currency
    plan.total_income = payload.total_income

    # Полностью заменяем строки распределения присланными — проще и надёжнее,
    # чем построчный diff, а план редактируется целиком с фронтенда за раз.
    # Это только ПЛАН (сколько собираетесь потратить/отложить) — на реальный
    # прогресс целей (Goal.current_amount) он не влияет, в отличие от факта
    # (Transaction), см. app/api/routes/transactions.py.
    plan.allocations.clear()
    await db.flush()

    for allocation_input in payload.allocations:
        plan.allocations.append(
            PlanAllocation(
                category_id=allocation_input.category_id,
                planned_amount=allocation_input.planned_amount,
            )
        )

    await db.commit()

    result = await db.execute(
        select(MonthlyPlan).options(*_PLAN_LOAD_OPTIONS).where(MonthlyPlan.id == plan.id)
    )
    return result.scalar_one()
