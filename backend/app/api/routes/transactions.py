"""
Роуты трат/доходов (Главный экран 2 — "Трекер"), включая /summary — сводную
таблицу "план vs факт" по категориям за произвольный период (день/неделя/
месяц/свой диапазон — п.3 требований "каждую неделю/день/(выбранный
промежуток времени)").
"""

import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import CategoryType
from app.models.plan import MonthlyPlan, PlanAllocation
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    CategorySummaryItem,
    PeriodSummary,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
async def list_transactions(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    category_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.user_id == current_user.id)
    )
    if date_from is not None:
        query = query.where(Transaction.occurred_on >= date_from)
    if date_to is not None:
        query = query.where(Transaction.occurred_on <= date_to)
    if category_id is not None:
        query = query.where(Transaction.category_id == category_id)
    query = query.order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = Transaction(user_id=current_user.id, **payload.model_dump())
    db.add(transaction)
    await db.commit()
    result = await db.execute(
        select(Transaction).options(selectinload(Transaction.category)).where(Transaction.id == transaction.id)
    )
    return result.scalar_one()


async def _get_owned_transaction(transaction_id: uuid.UUID, current_user: User, db: AsyncSession) -> Transaction:
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()
    if transaction is None or transaction.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Операция не найдена")
    return transaction


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = await _get_owned_transaction(transaction_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)
    await db.commit()
    result = await db.execute(
        select(Transaction).options(selectinload(Transaction.category)).where(Transaction.id == transaction.id)
    )
    return result.scalar_one()


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = await _get_owned_transaction(transaction_id, current_user, db)
    await db.delete(transaction)
    await db.commit()


@router.get("/summary/period", response_model=PeriodSummary)
async def get_period_summary(
    period_start: date = Query(...),
    period_end: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Собирает таблицу "план vs факт" за произвольный период. Плановые суммы
    берутся из плана на месяц period_start и пропорционально не делятся —
    вместо этого показываем "сколько потрачено из месячного плана к этому
    моменту", что нагляднее для пользователя, чем дробление плана на дни.
    """
    plan_month = period_start.replace(day=1)
    plan_result = await db.execute(
        select(MonthlyPlan)
        .options(selectinload(MonthlyPlan.allocations).selectinload(PlanAllocation.category))
        .where(MonthlyPlan.user_id == current_user.id, MonthlyPlan.month == plan_month)
    )
    plan = plan_result.scalar_one_or_none()

    tx_result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == CategoryType.EXPENSE,
            Transaction.occurred_on >= period_start,
            Transaction.occurred_on <= period_end,
        )
    )
    transactions = tx_result.scalars().all()

    actual_by_category: dict[uuid.UUID, Decimal] = {}
    for tx in transactions:
        actual_by_category[tx.category_id] = actual_by_category.get(tx.category_id, Decimal("0")) + Decimal(
            tx.amount
        )

    categories: list[CategorySummaryItem] = []
    planned_ids: set[uuid.UUID] = set()

    if plan is not None:
        for allocation in plan.allocations:
            planned = Decimal(allocation.planned_amount)
            actual = actual_by_category.get(allocation.category_id, Decimal("0"))
            planned_ids.add(allocation.category_id)
            categories.append(
                CategorySummaryItem(
                    category_id=allocation.category_id,
                    category_name=allocation.category.name,
                    category_color=allocation.category.color,
                    category_icon=allocation.category.icon,
                    planned_amount=planned,
                    actual_amount=actual,
                    remaining_amount=planned - actual,
                    percent_used=round(float(actual) / float(planned) * 100, 1) if planned else 0.0,
                )
            )

    # Категории, по которым есть траты, но нет плана — тоже показываем,
    # чтобы пользователь видел ВСЕ свои расходы, а не только запланированные.
    for tx in transactions:
        if tx.category_id in planned_ids:
            continue
        planned_ids.add(tx.category_id)
        actual = actual_by_category[tx.category_id]
        categories.append(
            CategorySummaryItem(
                category_id=tx.category_id,
                category_name=tx.category.name,
                category_color=tx.category.color,
                category_icon=tx.category.icon,
                planned_amount=Decimal("0"),
                actual_amount=actual,
                remaining_amount=-actual,
                percent_used=0.0,
            )
        )

    return PeriodSummary(
        period_start=period_start,
        period_end=period_end,
        currency=plan.currency if plan else current_user.settings.default_currency,
        total_planned=sum((c.planned_amount for c in categories), Decimal("0")),
        total_actual=sum((c.actual_amount for c in categories), Decimal("0")),
        total_income=plan.total_income if plan else Decimal("0"),
        categories=sorted(categories, key=lambda c: c.actual_amount, reverse=True),
    )
