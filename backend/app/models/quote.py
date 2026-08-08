"""
Мотивационные фразы, которые показываются пользователю при входе в
приложение (см. п.3 требований). Хранятся в БД (а не хардкодятся на
фронтенде), чтобы:
  - можно было добавлять новые фразы без деплоя нового кода;
  - в будущем показывать разные фразы в зависимости от ситуации пользователя
    (например, category="overspend" — если он вышел за рамки бюджета,
    category="on_track" — если всё идёт по плану).
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import UUIDPrimaryKeyMixin


class MotivationalQuote(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "motivational_quotes"

    text: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str | None] = mapped_column(String(150), nullable=True)
    # "general" | "on_track" | "overspend" | "goal_progress"
    category: Mapped[str] = mapped_column(String(30), default="general", nullable=False)
