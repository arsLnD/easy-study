import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.category import CategoryType
from app.schemas.category import CategoryRead


class TransactionCreate(BaseModel):
    category_id: uuid.UUID
    type: CategoryType
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    description: str | None = Field(default=None, max_length=255)
    occurred_on: date


class TransactionUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=255)
    occurred_on: date | None = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category_id: uuid.UUID
    type: CategoryType
    amount: Decimal
    currency: str
    description: str | None = None
    occurred_on: date
    category: CategoryRead | None = None


class CategorySummaryItem(BaseModel):
    category_id: uuid.UUID
    category_name: str
    category_color: str
    category_icon: str
    planned_amount: Decimal
    actual_amount: Decimal
    remaining_amount: Decimal
    percent_used: float


class PeriodSummary(BaseModel):
    period_start: date
    period_end: date
    currency: str
    total_planned: Decimal
    total_actual: Decimal
    total_income: Decimal
    total_income_actual: Decimal
    categories: list[CategorySummaryItem]
