"""
Роуты трат/доходов (Главный экран 2 — "Трекер"), включая /summary — сводную
таблицу "план vs факт" по категориям за произвольный период (день/неделя/
месяц/свой диапазон — п.3 требований "каждую неделю/день/(выбранный
промежуток времени)").

Пополнение цели накопления — это обычная трата (Transaction) в служебной
категории цели (Category.linked_goal_id, см. app/api/routes/goals.py).
_sync_goal_amount ниже пересчитывает Goal.current_amount при создании,
изменении и удалении такой операции, чтобы прогресс цели всегда совпадал с
суммой реальных трат в её категории — без отдельной денормализованной
сущности "пополнение", которую можно забыть обновить.
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
from app.models.category import Category, CategoryType
from app.models.goal import Goal, GoalStatus
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


async def _sync_goal_amount(
    db: AsyncSession, category_id: uuid.UUID, delta: Decimal, user_id: uuid.UUID
) -> None:
    """Применяет +/- delta к Goal.current_amount, если category_id — категория цели."""
    if delta == 0:
        return
    cat_result = await db.execute(select(Category.linked_goal_id).where(Category.id == category_id))
    goal_id = cat_result.scalar_one_or_none()
    if goal_id is None:
        return
    goal_result = await db.execute(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        return

    goal.current_amount = max(Decimal("0"), Decimal(goal.current_amount) + delta)
    if goal.current_amount >= goal.target_amount and goal.status == GoalStatus.ACTIVE:
        goal.status = GoalStatus.COMPLETED
    elif goal.current_amount < goal.target_amount and goal.status == GoalStatus.COMPLETED:
        goal.status = GoalStatus.ACTIVE


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
    if payload.type == CategoryType.EXPENSE:
        await _sync_goal_amount(db, payload.category_id, Decimal(payload.amount), current_user.id)
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
    old_category_id = transaction.category_id
    old_amount = Decimal(transaction.amount)
    was_expense = transaction.type == CategoryType.EXPENSE

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)

    # Тип операции (доход/трата) сейчас не редактируется через этот эндпоинт
    # (см. TransactionUpdate), поэтому was_expense == is_expense — но считаем
    # дельту явно по старой/новой категории и сумме на случай, если это
    # изменится в будущем.
    is_expense = transaction.type == CategoryType.EXPENSE
    if was_expense:
        await _sync_goal_amount(db, old_category_id, -old_amount, current_user.id)
    if is_expense:
        await _sync_goal_amount(db, transaction.category_id, Decimal(transaction.amount), current_user.id)

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
    if transaction.type == CategoryType.EXPENSE:
        await _sync_goal_amount(db, transaction.category_id, -Decimal(transaction.amount), current_user.id)
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
            Transaction.occurred_on >= period_start,
            Transaction.occurred_on <= period_end,
        )
    )
    all_transactions = tx_result.scalars().all()
    transactions = [tx for tx in all_transactions if tx.type == CategoryType.EXPENSE]
    income_transactions = [tx for tx in all_transactions if tx.type == CategoryType.INCOME]

    total_income_actual = sum((Decimal(tx.amount) for tx in income_transactions), Decimal("0"))

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
        total_income_actual=total_income_actual,
        categories=sorted(categories, key=lambda c: c.actual_amount, reverse=True),
    )
