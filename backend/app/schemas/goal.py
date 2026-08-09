import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.goal import GoalStatus


class GoalBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    icon: str = "target"
    color: str = "#00E38C"
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    target_amount: Decimal = Field(gt=0)
    deadline: date | None = None


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    icon: str | None = None
    color: str | None = None
    target_amount: Decimal | None = Field(default=None, gt=0)
    deadline: date | None = None
    status: GoalStatus | None = None


class GoalRead(GoalBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    current_amount: Decimal
    status: GoalStatus
    progress_percent: float = 0.0


class GoalContributionCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    contributed_on: date
    plan_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=255)


class GoalContributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    amount: Decimal
    contributed_on: date
    note: str | None = None


class GoalContributionWithGoalRead(BaseModel):
    id: uuid.UUID
    amount: Decimal
    contributed_on: date
    note: str | None = None
    goal_id: uuid.UUID
    goal_name: str
    goal_icon: str
    goal_color: str
