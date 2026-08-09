"""
Месячный план (бюджет).

MonthlyPlan — это "шапка" плана на конкретный месяц: сколько пользователь
ожидает заработать (доход).

PlanAllocation — это строки таблицы плана: сколько денег выделено на каждую
категорию трат в рамках этого месяца (например "Еда — 20 000 ₸"). Отчисления
на цели — это точно такие же строки, но для служебной категории цели
(Category.linked_goal_id) — плановую сумму сбережений на цель вводят в общем
списке категорий, а не отдельным разделом (см. app/models/goal.py).
Сумма всех PlanAllocation не должна превышать total_income — это проверяется
на фронтенде (индикатор "Свободный остаток"), а не на уровне БД, чтобы можно
было гибко менять правила в будущем.

Один пользователь может иметь только один план на конкретный месяц —
это обеспечено уникальным ограничением (user_id, month).
"""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class MonthlyPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "monthly_plans"
    __table_args__ = (UniqueConstraint("user_id", "month", name="uq_plan_user_month"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Всегда хранится как первое число месяца (2026-08-01), чтобы легко искать
    # "план на август 2026" без сравнения диапазонов дат.
    month: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    total_income: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    user: Mapped["User"] = relationship(back_populates="plans")
    allocations: Mapped[list["PlanAllocation"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )


class PlanAllocation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Сколько денег план выделяет на конкретную категорию трат."""

    __tablename__ = "plan_allocations"
    __table_args__ = (UniqueConstraint("plan_id", "category_id", name="uq_allocation_plan_category"),)

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("monthly_plans.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    planned_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    plan: Mapped["MonthlyPlan"] = relationship(back_populates="allocations")
    category: Mapped["Category"] = relationship(back_populates="allocations")
