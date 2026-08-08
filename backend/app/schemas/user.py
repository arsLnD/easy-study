"""Pydantic-схемы User/UserSettings — определяют форму JSON на входе и выходе API."""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import EntryFrequency


class UserSettingsBase(BaseModel):
    default_currency: str = Field(default="RUB", min_length=3, max_length=3)
    entry_frequency: EntryFrequency = EntryFrequency.WEEKLY
    custom_frequency_days: int = Field(default=7, ge=1, le=90)
    motivational_quotes_enabled: bool = True
    theme: str = "dark"


class UserSettingsUpdate(BaseModel):
    default_currency: str | None = Field(default=None, min_length=3, max_length=3)
    entry_frequency: EntryFrequency | None = None
    custom_frequency_days: int | None = Field(default=None, ge=1, le=90)
    motivational_quotes_enabled: bool | None = None
    theme: str | None = None


class UserSettingsRead(UserSettingsBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    full_name: str
    settings: UserSettingsRead | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
