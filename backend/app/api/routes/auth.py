"""
Роуты регистрации / входа / обновления токена.

Флоу:
  POST /api/auth/register — создать пользователя + пустые настройки по
    умолчанию, вернуть пару токенов (пользователь сразу залогинен).
  POST /api/auth/login — проверить email+пароль, вернуть пару токенов.
  POST /api/auth/refresh — обменять refresh_token на новую пару токенов.
  GET  /api/auth/me — данные текущего пользователя (проверка токена на фронте).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User, UserSettings
from app.schemas.user import RefreshRequest, TokenPair, UserCreate, UserLogin, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _account_email(login: str | None, email: str | None) -> str:
    if email:
        return str(email).lower()
    if login:
        raw = login.strip().lower()
        return raw if "@" in raw else f"{raw}@easy-study.app"
    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Укажи логин")


def _account_name(login: str | None, full_name: str | None, email: str) -> str:
    if full_name and full_name.strip():
        return full_name.strip()
    if login and login.strip():
        return login.strip()
    return email.split("@")[0]


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    email = _account_email(payload.login, payload.email)
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Такой логин уже есть")

    display = _account_name(payload.login, payload.full_name, email)
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=display,
    )
    db.add(user)
    await db.flush()  # получаем user.id до commit

    db.add(UserSettings(user_id=user.id))
    await db.commit()

    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        login=display,
    )


@router.post("/login", response_model=TokenPair)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    email = _account_email(payload.login, payload.email)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный логин или пароль")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Учётная запись отключена")

    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        login=user.full_name or email.split("@")[0],
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_data = decode_token(payload.refresh_token)
    if token_data is None or token_data.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный refresh-токен")

    try:
        user_id = uuid.UUID(token_data["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный refresh-токен")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь не найден")

    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        login=user.full_name or user.email.split("@")[0],
    )


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
