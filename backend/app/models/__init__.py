"""
Импортируем все модели в одном месте, чтобы:
  1. SQLAlchemy знал обо всех таблицах при вызове Base.metadata.create_all()
     (используется в скрипте инициализации / тестах).
  2. Alembic (генератор миграций) видел все модели при автогенерации
     миграций (`alembic revision --autogenerate`).
"""

from app.models.category import Category, CategoryType
from app.models.goal import Goal, GoalContribution, GoalStatus
from app.models.plan import MonthlyPlan, PlanAllocation
from app.models.quote import MotivationalQuote
from app.models.transaction import Transaction
from app.models.user import EntryFrequency, User, UserSettings

__all__ = [
    "User",
    "UserSettings",
    "EntryFrequency",
    "Category",
    "CategoryType",
    "MonthlyPlan",
    "PlanAllocation",
    "Goal",
    "GoalContribution",
    "GoalStatus",
    "Transaction",
    "MotivationalQuote",
]
