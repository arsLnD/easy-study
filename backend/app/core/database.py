"""
Настройка подключения к PostgreSQL через SQLAlchemy (асинхронный движок).

Почему PostgreSQL:
- Надёжная, бесплатная, с открытым исходным кодом СУБД промышленного уровня.
- Отлично работает с типами данных, которые нам нужны: Numeric (для денег,
  без ошибок округления float), Date/DateTime, Enum, JSON (для гибких настроек).
- Прекрасно масштабируется, если позже понадобится больше пользователей.
- Бесплатные managed-инстансы есть у Railway, Render, Supabase, Neon — это
  упрощает деплой (см. README.md, раздел "Хостинг").

Почему асинхронный SQLAlchemy (AsyncSession) + asyncpg:
- FastAPI полностью асинхронный, и асинхронный доступ к БД не блокирует
  обработку других запросов, пока идёт ожидание ответа от базы данных.
  Это даёт лучшую производительность при множестве одновременных пользователей.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # поставить True для отладки — тогда в консоль печатается каждый SQL-запрос
    pool_pre_ping=True,  # проверяет, что соединение живо, перед каждым запросом
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей приложения (app/models/*.py)."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency: открывает сессию БД на время одного запроса
    и гарантированно закрывает её после ответа (даже если было исключение).
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
