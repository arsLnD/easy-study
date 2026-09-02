"""
Центральная конфигурация приложения.

Все настраиваемые параметры (строка подключения к БД, секреты JWT, время жизни
токенов, список разрешённых CORS-источников и т.д.) читаются из переменных
окружения (файл .env в папке backend/). Это стандартная практика — секреты
никогда не хранятся в коде, а .env файл не должен попадать в git (см. .gitignore).

Используем pydantic-settings, чтобы значения автоматически валидировались
(например, PORT должен быть числом) и было единое типизированное место,
из которого весь остальной код читает конфигурацию (app.core.config.settings).
"""

from functools import lru_cache
from typing import Annotated, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    # --- Общие настройки приложения ---
    APP_NAME: str = "Plans/Finance"
    ENVIRONMENT: str = "development"  # development | production
    API_V1_PREFIX: str = "/api"

    # --- База данных ---
    # Пример: postgresql+asyncpg://plans_user:plans_password@localhost:5432/plans_finance
    DATABASE_URL: str = (
        "postgresql+asyncpg://plans_user:plans_password@localhost:5432/plans_finance"
    )

    # --- Аутентификация / JWT ---
    # СЕКРЕТ ОБЯЗАТЕЛЬНО меняется в .env перед продакшн-развёртыванием.
    JWT_SECRET_KEY: str = "change-this-secret-in-env-file-before-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- CORS: с каких адресов фронтенду разрешено обращаться к API ---
    # Annotated[..., NoDecode] отключает попытку pydantic-settings распарсить
    # значение из .env как JSON (по умолчанию это происходит для list-полей
    # и ломается на обычной строке "a,b,c") — вместо этого сырую строку
    # получает наш собственный валидатор ниже.
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # --- AI-рекомендации бюджета (DeepSeek, OpenAI-совместимый API) ---
    # Если ключ не задан — приложение автоматически использует встроенный
    # алгоритм (история трат / правило 50-30-20), см. app/services/recommendations.py.
    # Получить ключ: platform.deepseek.com -> API keys (даётся бесплатный грант
    # 5 млн токенов на 30 дней новым аккаунтам, дальше — очень дешёвый pay-as-you-go).
    DEEPSEEK_API_KEY: str | None = None
    DEEPSEEK_API_BASE: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-v4-flash"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Кэшированный singleton настроек, чтобы .env читался один раз за запуск."""
    return Settings()


settings = get_settings()
