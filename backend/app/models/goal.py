"""
Финансовые цели пользователя (накопить на отпуск, подушку безопасности и т.д.)

Goal — сама цель: название, сумма цели, срок, текущий накопленный прогресс.
GoalContribution — история пополнений цели, привязанная (опционально) к
конкретному месячному плану, чтобы можно было построить историю "сколько
я отложил на цель X в каждом месяце" и показывать это в таблице трекера.

current_amount хранится денормализованно (как сумма всех contributions) для
быстрого чтения на главном экране без лишних JOIN-агрегаций на каждый рендер;
пересчитывается транзакционно при каждом добавлении/удалении contribution
(см. app/api/routes/goals.py).
"""

import enum
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, pg_enum


class GoalStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Goal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="target", nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#00E38C", nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    target_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[GoalStatus] = mapped_column(
        pg_enum(GoalStatus, "goal_status"), default=GoalStatus.ACTIVE, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="goals")
    contributions: Mapped[list["GoalContribution"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan"
    )


class GoalContribution(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "goal_contributions"

    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("monthly_plans.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    contributed_on: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    goal: Mapped["Goal"] = relationship(back_populates="contributions")
    plan: Mapped["MonthlyPlan"] = relationship(back_populates="goal_contributions")
