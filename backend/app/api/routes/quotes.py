"""Роут мотивационной фразы, показываемой при входе в приложение."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.quote import MotivationalQuote
from app.models.user import User
from app.schemas.quote import QuoteRead

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("/random", response_model=QuoteRead)
async def get_random_quote(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MotivationalQuote).order_by(func.random()).limit(1))
    return result.scalar_one()
