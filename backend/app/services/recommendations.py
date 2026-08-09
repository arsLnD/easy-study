"""
Сервис рекомендаций бюджета — помогает пользователю решить, сколько денег
выделить на каждую категорию и сколько отложить на цели (п.2 требований:
"приложение должно помогать с выбором пользователю").

Отчисления на цели больше не отдельная сумма — цель — это такая же категория
расходов (Category.linked_goal_id), поэтому рекомендация просто добавляет ей
item с bucket="savings" наравне с обычными категориями (см. _bucket_for).

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
   между существующими категориями пользователя. Сбережения распределяются
   между активными целями пропорционально тому, сколько им ещё не хватает
   до цели (см. _distribute_savings_to_goals).

Правило 50/30/20 — общепризнанный, простой ориентир из личных финансов
(его популяризировала сенатор США Элизабет Уоррен в книге "All Your
Worth"), поэтому это разумная нейтральная отправная точка для тех, у кого
нет собственной истории трат.
"""

import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, CategoryType
from app.models.goal import Goal, GoalStatus
from app.models.transaction import Transaction
from app.schemas.plan import RecommendationCategoryItem, RecommendationResponse
from app.services.ai_recommendation import get_ai_recommendation

ESSENTIAL_SHARE = Decimal("0.5")
LIFESTYLE_SHARE = Decimal("0.3")
SAVINGS_SHARE = Decimal("0.2")

HISTORY_MONTHS = 3


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _bucket_for(category: Category) -> str:
    if category.linked_goal_id is not None:
        return "savings"
    return "essential" if category.is_essential else "lifestyle"


async def _get_user_expense_categories(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
    result = await db.execute(
        select(Category).where(
            Category.type == CategoryType.EXPENSE,
            (Category.user_id == user_id) | (Category.user_id.is_(None)),
        )
    )
    return list(result.scalars().all())


def _distribute_savings_to_goals(
    goal_categories: list[Category],
    goals_by_id: dict[uuid.UUID, Goal],
    pool: Decimal,
    based_on: str,
) -> list[RecommendationCategoryItem]:
    """
    Делит `pool` денег между служебными категориями активных целей
    пропорционально тому, сколько каждой цели ещё не хватает до
    target_amount (никакого смысла продолжать откладывать сверх цели).
    """
    if pool <= 0:
        return []

    needs: dict[uuid.UUID, Decimal] = {}
    for category in goal_categories:
        goal = goals_by_id.get(category.linked_goal_id) if category.linked_goal_id else None
        if goal is None or goal.status != GoalStatus.ACTIVE:
            continue
        remaining = Decimal(goal.target_amount) - Decimal(goal.current_amount)
        if remaining > 0:
            needs[category.id] = remaining

    if not needs:
        return []

    total_need = sum(needs.values(), Decimal("0"))
    items: list[RecommendationCategoryItem] = []
    for category in goal_categories:
        need = needs.get(category.id)
        if need is None:
            continue
        share = _round_money(min(need, pool * (need / total_need)))
        if share <= 0:
            continue
        items.append(
            RecommendationCategoryItem(
                category_id=category.id,
                category_name=category.name,
                suggested_amount=share,
                bucket="savings",
                based_on=based_on,
            )
        )
    return items


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


async def _get_active_goals(db: AsyncSession, user_id: uuid.UUID) -> list[Goal]:
    result = await db.execute(select(Goal).where(Goal.user_id == user_id, Goal.status == GoalStatus.ACTIVE))
    return list(result.scalars().all())


def _goals_context(goals: list[Goal]) -> list[dict]:
    return [
        {
            "name": g.name,
            "current": Decimal(g.current_amount),
            "target": Decimal(g.target_amount),
            "currency": g.currency,
        }
        for g in goals
    ]


async def build_budget_recommendation(
    db: AsyncSession,
    user_id: uuid.UUID,
    total_income: Decimal,
    reference_month: date | None = None,
    currency: str = "RUB",
) -> RecommendationResponse:
    """
    Пытается получить рекомендацию от DeepSeek (если настроен API-ключ), а при
    его отсутствии или любой ошибке запроса — молча откатывается на
    детерминированный алгоритм ниже. Это гарантирует, что кнопка "Помочь
    распределить бюджет" всегда что-то возвращает, независимо от доступности
    внешнего AI-сервиса.
    """
    reference_month = reference_month or date.today()
    categories = await _get_user_expense_categories(db, user_id)
    history = await _get_recent_average_spending(db, user_id, reference_month)
    goals = await _get_active_goals(db, user_id)

    ai_result = await get_ai_recommendation(total_income, currency, categories, history, _goals_context(goals))
    if ai_result is not None:
        return ai_result

    goals_by_id = {g.id: g for g in goals}
    return _build_rule_based_recommendation(categories, history, total_income, goals_by_id)


def _build_rule_based_recommendation(
    categories: list[Category],
    history: dict[uuid.UUID, Decimal],
    total_income: Decimal,
    goals_by_id: dict[uuid.UUID, Goal],
) -> RecommendationResponse:
    goal_categories = [c for c in categories if c.linked_goal_id is not None]
    spending_categories = [c for c in categories if c.linked_goal_id is None]

    has_enough_history = sum((history.get(c.id, Decimal("0")) for c in spending_categories), Decimal("0")) > 0

    items: list[RecommendationCategoryItem] = []

    if has_enough_history:
        total_history = sum((history.get(c.id, Decimal("0")) for c in spending_categories), Decimal("0")) or Decimal(
            "1"
        )
        # Масштабируем историю так, чтобы уложиться в 80% дохода (оставляя
        # минимум 20% на сбережения), сохраняя пропорции между категориями.
        spendable = total_income * (Decimal("1") - SAVINGS_SHARE)
        scale = min(Decimal("1"), spendable / total_history) if total_history else Decimal("1")

        for category in spending_categories:
            avg = history.get(category.id)
            if not avg:
                continue
            suggested = _round_money(avg * scale)
            items.append(
                RecommendationCategoryItem(
                    category_id=category.id,
                    category_name=category.name,
                    suggested_amount=suggested,
                    bucket=_bucket_for(category),
                    based_on="history",
                )
            )

        essential_total = sum((i.suggested_amount for i in items if i.bucket == "essential"), Decimal("0"))
        lifestyle_total = sum((i.suggested_amount for i in items if i.bucket == "lifestyle"), Decimal("0"))
        leftover = max(Decimal("0"), _round_money(total_income - essential_total - lifestyle_total))

        savings_items = _distribute_savings_to_goals(goal_categories, goals_by_id, leftover, "history")
        items.extend(savings_items)
        savings_total = sum((i.suggested_amount for i in savings_items), Decimal("0"))

        explanation = (
            f"Рекомендация основана на ваших средних тратах за последние "
            f"{HISTORY_MONTHS} месяца, масштабированных под указанный доход "
            f"так, чтобы гарантированно осталось не менее {int(SAVINGS_SHARE * 100)}% на сбережения."
        )
        if not goal_categories and leftover > 0:
            explanation += " Создайте цель в разделе «Настройки → Цели» — тогда мы предложим, сколько на неё отложить."
        elif goal_categories and not savings_items:
            explanation += " Похоже, все ваши активные цели уже достигнуты — можете добавить новую."
    else:
        essential_categories = [c for c in spending_categories if c.is_essential]
        lifestyle_categories = [c for c in spending_categories if not c.is_essential]

        essential_total = _round_money(total_income * ESSENTIAL_SHARE)
        lifestyle_total = _round_money(total_income * LIFESTYLE_SHARE)
        savings_pool = _round_money(total_income - essential_total - lifestyle_total)

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

        savings_items = _distribute_savings_to_goals(goal_categories, goals_by_id, savings_pool, "rule_50_30_20")
        items.extend(savings_items)
        savings_total = sum((i.suggested_amount for i in savings_items), Decimal("0"))

        explanation = (
            "У вас пока нет истории трат, поэтому мы использовали классическое "
            "правило бюджетирования 50/30/20: 50% дохода — на обязательные "
            "траты, 30% — на необязательные, 20% — на сбережения. "
            "Как только вы начнёте вносить траты, рекомендации станут точнее "
            "и будут основаны на вашем реальном поведении."
        )
        if not goal_categories:
            explanation += " Создайте цель в разделе «Настройки → Цели», чтобы мы предложили, сколько на неё отложить."

    return RecommendationResponse(
        essential_total=essential_total,
        lifestyle_total=lifestyle_total,
        savings_total=savings_total,
        items=items,
        explanation=explanation,
    )
