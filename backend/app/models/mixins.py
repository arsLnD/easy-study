"""Общие "миксины" (переиспользуемые кусочки моделей), чтобы не повторять код."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


def pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """
    Обёртка над sa.Enum для наших Python str-enum'ов (например CategoryType).

    По умолчанию SQLAlchemy сохраняет в БД ИМЯ элемента enum (например
    "EXPENSE"), а не его значение ("expense") — это частый источник багов,
    когда в самой Postgres-миграции тип создан со значениями в нижнем
    регистре. values_callable явно указывает использовать .value, чтобы
    Python-модель и структура БД были согласованы.
    """
    return Enum(enum_cls, name=name, values_callable=lambda obj: [e.value for e in obj])


class UUIDPrimaryKeyMixin:
    """
    Первичный ключ в виде UUID вместо простого числа 1, 2, 3...

    Зачем: UUID нельзя угадать/перебрать (в отличие от id=1, id=2...), поэтому
    его безопасно использовать напрямую в URL API (/api/goals/<id>) — соседний
    пользователь не сможет подобрать чужой id и попытаться получить его данные.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    """Автоматические поля created_at / updated_at для аудита данных."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
