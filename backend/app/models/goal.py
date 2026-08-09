"""
Финансовые цели пользователя (накопить на отпуск, подушку безопасности и т.д.)

Goal — сама цель: название, сумма цели, срок, текущий накопленный прогресс.

У каждой цели есть привязанная категория трат (Category.linked_goal_id,
создаётся автоматически в app/api/routes/goals.py при создании цели).
Пополнение цели — это ОБЫЧНАЯ трата (Transaction) в этой категории, а не
отдельная сущность вне плана: так пополнения попадают в общий список
операций, учитываются в плане/факте по категориям и их можно редактировать
как любую другую операцию (см. app/api/routes/transactions.py).

current_amount хранится денормализованно (как сумма трат в категории цели)
для быстрого чтения на главном экране без лишних JOIN-агрегаций на каждый
рендер; пересчитывается транзакционно при каждом создании/изменении/удалении
транзакции в категории цели (см. _sync_goal_amount в app/api/routes/transactions.py).
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
    category: Mapped["Category | None"] = relationship(back_populates="linked_goal", uselist=False)
