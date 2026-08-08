import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.category import CategoryType


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    icon: str = "tag"
    color: str = "#7C5CFF"
    is_essential: bool = False


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    icon: str | None = None
    color: str | None = None
    is_essential: bool | None = None


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    is_preset: bool
    user_id: uuid.UUID | None = None
