"""
FastAPI dependency-функции: получить текущую сессию БД и текущего
авторизованного пользователя из JWT access-токена.

Как это работает:
1. Фронтенд отправляет заголовок `Authorization: Bearer <access_token>`.
2. `oauth2_scheme` (из fastapi.security) достаёт токен из заголовка.
3. `get_current_user` расшифровывает токен, проверяет тип и срок действия,
   находит пользователя в БД по id из поля "sub" токена.
4. Если что-то не так — 401 Unauthorized, и фронтенд должен либо обновить
   токен через /api/auth/refresh, либо отправить пользователя на экран входа.
"""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось подтвердить учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_error

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_error

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise credentials_error

    result = await db.execute(
        select(User).options(selectinload(User.settings)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_error

    return user
