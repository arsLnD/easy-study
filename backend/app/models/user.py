"""
Модель пользователя и его персональных настроек.

Разделение User / UserSettings сделано намеренно:
- User хранит только то, что нужно для аутентификации и идентификации
  (email, хеш пароля, имя).
- UserSettings хранит все "настройки удобства", которые пользователь может
  менять на экранах настроек: валюта по умолчанию, периодичность заполнения
  трат (день/неделя/свой интервал), включены ли уведомления и т.д.

Это позволяет расширять настройки в будущем, не трогая таблицу User (которая
завязана на логику безопасности) и не раздувать её десятками столбцов.
"""

import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, pg_enum


class EntryFrequency(str, enum.Enum):
    """Как часто пользователь предпочитает вносить траты."""

    DAILY = "daily"
    WEEKLY = "weekly"
    CUSTOM = "custom"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    settings: Mapped["UserSettings"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    plans: Mapped[list["MonthlyPlan"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Валюта по умолчанию, ISO 4217 код (RUB, USD, EUR, KZT...). Мультивалютность:
    # каждая транзакция/цель также хранит СВОЮ валюту, но эта — используется
    # как значение по умолчанию в формах, чтобы не выбирать её каждый раз.
    default_currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)

    entry_frequency: Mapped[EntryFrequency] = mapped_column(
        pg_enum(EntryFrequency, "entry_frequency"), default=EntryFrequency.WEEKLY, nullable=False
    )
    # Используется только когда entry_frequency == CUSTOM: раз в N дней.
    custom_frequency_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)

    motivational_quotes_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    theme: Mapped[str] = mapped_column(String(20), default="dark", nullable=False)

    user: Mapped["User"] = relationship(back_populates="settings")
