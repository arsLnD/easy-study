"""
Всё, что связано с безопасностью: хеширование паролей и работа с JWT-токенами.

Пароли:
- Пароли пользователей НИКОГДА не хранятся в открытом виде. Мы храним только
  bcrypt-хеш (библиотека passlib). Даже если базу данных украдут, восстановить
  исходный пароль из хеша вычислительно нереально.

JWT (JSON Web Token):
- После входа сервер выдаёт клиенту два токена:
    * access_token  — короткоживущий (30 минут по умолчанию), передаётся в
      заголовке Authorization: Bearer <token> при каждом запросе к API.
    * refresh_token — долгоживущий (30 дней), используется только для того,
      чтобы получить новый access_token, когда старый истёк, без повторного
      ввода пароля.
- Токены подписаны секретным ключом на сервере (JWT_SECRET_KEY), поэтому их
  нельзя подделать без знания секрета.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(subject: str, expires_delta: timedelta, token_type: Literal["access", "refresh"]) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
