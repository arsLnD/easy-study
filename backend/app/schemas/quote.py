import uuid

from pydantic import BaseModel, ConfigDict


class QuoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    text: str
    author: str | None = None
    category: str
