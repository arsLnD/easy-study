"""
Точка входа приложения FastAPI. Запуск (см. README.md):

    uvicorn app.main:app --reload

Подключает CORS (чтобы фронтенд на отдельном порту/домене мог обращаться
к API), общий роутер со всеми эндпоинтами и глобальный health-check.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import Base, engine
from app.models.study import StudyMaterial, StudySettings, StudySubject  # noqa: F401

app = FastAPI(
    title=settings.APP_NAME,
    description="API для приложения контроля финансов и планирования бюджета Plans/Finance",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.on_event("startup")
async def _study_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
