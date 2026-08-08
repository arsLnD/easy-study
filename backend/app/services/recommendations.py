"""
Сервис рекомендаций бюджета — помогает пользователю решить, сколько денег
выделить на каждую категорию и сколько отложить на цели (п.2 требований:
"приложение должно помогать с выбором пользователю").

Логика в два уровня:

1. Если у пользователя ЕСТЬ история трат за последние 3 месяца — используем
   её: считаем среднемесячную трату по каждой категории и предлагаем именно
   эти суммы (скорректированные, чтобы не превысить доход). Это даёт более
   реалистичный план, основанный на реальном поведении человека.

2. Если истории нет (новый пользователь) — используем классическое
   правило бюджетирования 50/30/20:
     - 50% дохода -> обязательные траты (жильё, еда, транспорт, коммуналка) —
       категории с флагом is_essential=True.
     - 30% дохода -> необязательные траты/удовольствия (остальные
       категории расходов).
     - 20% дохода -> сбережения и цели.
   Внутри "обязательных" и "необязательных" сумма делится пропорционально
   между существующими категориями пользователя.

Правило 50/30/20 — общепризнанный, простой ориентир из личных финансов
(его популяризировала сенатор США Элизабет Уоррен в книге "All Your
Worth"), поэтому это разумная нейтральная отправная точка для тех, у кого
нет собственной истории трат.
"""

import uuid
from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, CategoryType
from app.models.transaction import Transaction
from app.schemas.plan import RecommendationCategoryItem, RecommendationResponse

ESSENTIAL_SHARE = Decimal("0.5")
LIFESTYLE_SHARE = Decimal("0.3")
SAVINGS_SHARE = Decimal("0.2")

HISTORY_MONTHS = 3


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def _get_user_expense_categories(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
    result = await db.execute(
        select(Category).where(
            Category.type == CategoryType.EXPENSE,
            (Category.user_id == user_id) | (Category.user_id.is_(None)),
        )
    )
    return list(result.scalars().all())


async def _get_recent_average_spending(
    db: AsyncSession, user_id: uuid.UUID, reference_month: date
) -> dict[uuid.UUID, Decimal]:
    period_start = reference_month.replace(day=1) - relativedelta(months=HISTORY_MONTHS)
    result = await db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == CategoryType.EXPENSE,
            Transaction.occurred_on >= period_start,
            Transaction.occurred_on < reference_month.replace(day=1),
        )
        .group_by(Transaction.category_id)
    )
    return {row[0]: Decimal(row[1]) / HISTORY_MONTHS for row in result.all()}


async def build_budget_recommendation(
    db: AsyncSession,
    user_id: uuid.UUID,
    total_income: Decimal,
    reference_month: date | None = None,
) -> RecommendationResponse:
    reference_month = reference_month or date.today()
    categories = await _get_user_expense_categories(db, user_id)
    history = await _get_recent_average_spending(db, user_id, reference_month)

    has_enough_history = sum(history.values(), Decimal("0")) > 0

    items: list[RecommendationCategoryItem] = []

    if has_enough_history:
        total_history = sum(history.values(), Decimal("0")) or Decimal("1")
        # Масштабируем историю так, чтобы уложиться в 80% дохода (оставляя
        # минимум 20% на сбережения), сохраняя пропорции между категориями.
        spendable = total_income * (Decimal("1") - SAVINGS_SHARE)
        scale = min(Decimal("1"), spendable / total_history) if total_history else Decimal("1")

        for category in categories:
            avg = history.get(category.id)
            if not avg:
                continue
            suggested = _round_money(avg * scale)
            items.append(
                RecommendationCategoryItem(
                    category_id=category.id,
                    category_name=category.name,
                    suggested_amount=suggested,
                    bucket="essential" if category.is_essential else "lifestyle",
                    based_on="history",
                )
            )

        essential_total = sum((i.suggested_amount for i in items if i.bucket == "essential"), Decimal("0"))
        lifestyle_total = sum((i.suggested_amount for i in items if i.bucket == "lifestyle"), Decimal("0"))
        savings_total = _round_money(total_income - essential_total - lifestyle_total)
        explanation = (
            f"Рекомендация основана на ваших средних тратах за последние "
            f"{HISTORY_MONTHS} месяца, масштабированных под указанный доход "
            f"так, чтобы гарантированно отложить не менее {int(SAVINGS_SHARE * 100)}% на цели."
        )
    else:
        essential_categories = [c for c in categories if c.is_essential]
        lifestyle_categories = [c for c in categories if not c.is_essential]

        essential_total = _round_money(total_income * ESSENTIAL_SHARE)
        lifestyle_total = _round_money(total_income * LIFESTYLE_SHARE)
        savings_total = _round_money(total_income - essential_total - lifestyle_total)

        def _distribute(bucket_categories: list[Category], bucket_total: Decimal, bucket_name: str):
            if not bucket_categories:
                return
            share = _round_money(bucket_total / len(bucket_categories))
            for category in bucket_categories:
                items.append(
                    RecommendationCategoryItem(
                        category_id=category.id,
                        category_name=category.name,
                        suggested_amount=share,
                        bucket=bucket_name,
                        based_on="rule_50_30_20",
                    )
                )

        _distribute(essential_categories, essential_total, "essential")
        _distribute(lifestyle_categories, lifestyle_total, "lifestyle")

        explanation = (
            "У вас пока нет истории трат, поэтому мы использовали классическое "
            "правило бюджетирования 50/30/20: 50% дохода — на обязательные "
            "траты, 30% — на необязательные, 20% — на сбережения и цели. "
            "Как только вы начнёте вносить траты, рекомендации станут точнее "
            "и будут основаны на вашем реальном поведении."
        )

    return RecommendationResponse(
        essential_total=essential_total,
        lifestyle_total=lifestyle_total,
        savings_total=savings_total,
        items=items,
        explanation=explanation,
    )
