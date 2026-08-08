"""
Отдельная запись о трате или доходе, которую пользователь вносит на экране
"Мои траты" (Tracker). Это самая "горячая" таблица — по ней строятся все
агрегаты (сравнение план/факт по категориям, суммы за неделю/день и т.д.),
поэтому на occurred_on и (user_id, occurred_on) стоит индекс.
"""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.category import CategoryType
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, pg_enum


class Transaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_user_occurred_on", "user_id", "occurred_on"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    type: Mapped[CategoryType] = mapped_column(pg_enum(CategoryType, "category_type"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)

    user: Mapped["User"] = relationship(back_populates="transactions")
    category: Mapped["Category"] = relationship(back_populates="transactions")
