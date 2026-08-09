"""
Категории трат/доходов (еда, транспорт, развлечения, зарплата...).

Модель поддерживает и "системные" преднастроенные категории (user_id = NULL,
видны всем пользователям, создаются один раз при инициализации базы через
seed-скрипт), и "пользовательские" категории (user_id = id пользователя,
видны только ему). Так реализуется требование "готовый набор + свои".
"""

import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, pg_enum


class CategoryType(str, enum.Enum):
    EXPENSE = "expense"
    INCOME = "income"


class Category(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "categories"

    # NULL = системная категория, доступная всем пользователям.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[CategoryType] = mapped_column(pg_enum(CategoryType, "category_type"), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="tag", nullable=False)  # имя иконки для фронтенда
    color: Mapped[str] = mapped_column(String(20), default="#7C5CFF", nullable=False)  # hex-цвет для UI
    is_preset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Условно "обязательная" категория (жильё, еда) помогает рекомендательному
    # движку помечать её как приоритетную при расчёте бюджета 50/30/20.
    is_essential: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Если задано — это автослужебная категория конкретной цели накопления.
    # Пополнение цели = обычная трата (Transaction) в этой категории, поэтому
    # оно попадает в общий список операций и в план/факт, а не живёт отдельной
    # сущностью "вне плана". unique=True, потому что у одной цели ровно одна
    # категория. ondelete="SET NULL" — при удалении цели категория (и история
    # трат в ней) не пропадает, просто перестаёт быть "целевой".
    linked_goal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="SET NULL"), unique=True, nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="categories")
    allocations: Mapped[list["PlanAllocation"]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")
    linked_goal: Mapped["Goal | None"] = relationship(back_populates="category")
