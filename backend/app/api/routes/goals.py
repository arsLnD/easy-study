"""
Роуты финансовых целей.

Пополнение цели больше не отдельная сущность — это обычная трата
(Transaction) в служебной категории цели, поэтому все операции с
пополнениями (создание/список/удаление) выполняются через
POST/GET/DELETE /api/transactions (см. app/api/routes/transactions.py и
_sync_goal_amount там же, которая пересчитывает Goal.current_amount).
Этот файл отвечает только за сами цели и их служебную категорию.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category, CategoryType
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalRead, GoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


def _to_read_model(goal: Goal) -> GoalRead:
    progress = float(goal.current_amount) / float(goal.target_amount) * 100 if goal.target_amount else 0.0
    data = GoalRead.model_validate(goal)
    data.progress_percent = round(min(progress, 100.0), 1)
    data.category_id = goal.category.id if goal.category else None
    return data


async def _get_owned_goal(goal_id: uuid.UUID, current_user: User, db: AsyncSession) -> Goal:
    result = await db.execute(
        select(Goal).options(selectinload(Goal.category)).where(Goal.id == goal_id)
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
        select(Goal)
        .options(selectinload(Goal.category))
        .where(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
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
    await db.flush()

    # Автоматически создаём служебную категорию трат для этой цели — именно
    # в неё будут попадать "пополнения" (обычные Transaction), см. докстринг
    # модуля выше.
    category = Category(
        user_id=current_user.id,
        name=goal.name,
        type=CategoryType.EXPENSE,
        icon=goal.icon,
        color=goal.color,
        is_preset=False,
        is_essential=False,
        linked_goal_id=goal.id,
    )
    db.add(category)

    await db.commit()
    await db.refresh(goal)
    goal.category = category
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

    # Название/иконка/цвет должны совпадать со служебной категорией, чтобы
    # она везде выглядела так же, как сама цель.
    if goal.category is not None:
        if "name" in payload.model_fields_set:
            goal.category.name = goal.name
        if "icon" in payload.model_fields_set:
            goal.category.icon = goal.icon
        if "color" in payload.model_fields_set:
            goal.category.color = goal.color

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
    # Отвязываем категорию перед удалением цели (ondelete=SET NULL сделал бы
    # то же самое на уровне БД, но делаем это явно на уровне ORM-объекта):
    # история трат в категории сохраняется, категория просто становится
    # обычной пользовательской, без привязки к цели.
    if goal.category is not None:
        goal.category.linked_goal_id = None
    await db.delete(goal)
    await db.commit()
