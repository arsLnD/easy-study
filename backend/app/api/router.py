"""Собирает все под-роутеры в единый API-роутер, подключаемый в main.py."""

from fastapi import APIRouter

from app.api.routes import auth, categories, goals, plans, quotes, transactions, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(categories.router)
api_router.include_router(plans.router)
api_router.include_router(goals.router)
api_router.include_router(transactions.router)
api_router.include_router(quotes.router)
