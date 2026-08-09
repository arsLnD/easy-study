import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryRead


class PlanAllocationInput(BaseModel):
    category_id: uuid.UUID
    planned_amount: Decimal = Field(ge=0)


class PlanAllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category_id: uuid.UUID
    planned_amount: Decimal
    category: CategoryRead | None = None


class MonthlyPlanCreate(BaseModel):
    month: date  # любой день месяца; сервер нормализует к первому числу
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    total_income: Decimal = Field(ge=0)
    # Отчисления на цели — это такие же строки, как обычная категория трат,
    # только category_id указывает на служебную категорию цели
    # (Category.linked_goal_id), см. app/models/goal.py.
    allocations: list[PlanAllocationInput] = Field(default_factory=list)


class MonthlyPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    month: date
    currency: str
    total_income: Decimal
    allocations: list[PlanAllocationRead] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    total_income: Decimal = Field(gt=0)
    month: date | None = None


class RecommendationCategoryItem(BaseModel):
    category_id: uuid.UUID
    category_name: str
    suggested_amount: Decimal
    bucket: str  # "essential" | "lifestyle" | "savings"
    based_on: str  # "history" | "rule_50_30_20"


class RecommendationResponse(BaseModel):
    essential_total: Decimal
    lifestyle_total: Decimal
    savings_total: Decimal
    items: list[RecommendationCategoryItem]
    explanation: str
