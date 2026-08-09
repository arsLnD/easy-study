"""
Роуты категорий. GET возвращает объединённый список: системные (preset)
+ созданные текущим пользователем — именно так фронтенд получает единый
список для выпадающих списков и форм.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category, CategoryType
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    type: CategoryType | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Category).where(
        or_(Category.user_id == current_user.id, Category.user_id.is_(None))
    )
    if type is not None:
        query = query.where(Category.type == type)
    query = query.order_by(Category.is_preset.desc(), Category.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = Category(user_id=current_user.id, is_preset=False, **payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def _get_owned_category(category_id: uuid.UUID, current_user: User, db: AsyncSession) -> Category:
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if category is None or category.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Категория не найдена")
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await _get_owned_category(category_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await _get_owned_category(category_id, current_user, db)
    if category.linked_goal_id is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Это служебная категория цели накопления — удалите саму цель в разделе «Цели».",
        )
    await db.delete(category)
    await db.commit()
