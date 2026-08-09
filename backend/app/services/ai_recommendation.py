"""
AI-версия рекомендации бюджета через DeepSeek (OpenAI-совместимый chat API).

Используется как дополнение к алгоритмической рекомендации
(app/services/recommendations.py._build_rule_based_recommendation): если в
.env задан DEEPSEEK_API_KEY, сначала пробуем спросить модель, а если ключа
нет или запрос по любой причине не удался (сеть, таймаут, невалидный JSON) —
вызывающий код молча откатывается на детерминированный алгоритм. Пользователь
никогда не видит ошибку — просто получает рекомендацию чуть менее
"умную", но гарантированно рабочую.

Мы намеренно доверяем модели только РАСПРЕДЕЛЕНИЕ СУММ (сколько денег на
какую категорию, включая служебные категории целей накопления), а не
классификацию категорий на "обязательные"/"необязательные"/"цель" — эта
классификация уже есть в данных (Category.is_essential,
Category.linked_goal_id) и пересчитывается на нашей стороне (essential_total/
lifestyle_total/savings_total считаются из items по бакету), чтобы итоговые
суммы были гарантированно консистентны с моделью данных, независимо от
того, что вернула нейросеть.
"""

import json
import logging
import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

import httpx

from app.core.config import settings
from app.models.category import Category
from app.schemas.plan import RecommendationCategoryItem, RecommendationResponse

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 20.0
SAVINGS_FLOOR_SHARE = Decimal("0.1")  # минимум 10% дохода на сбережения, даже если AI предложит меньше


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _build_prompt(
    total_income: Decimal,
    currency: str,
    categories: list[Category],
    history: dict[uuid.UUID, Decimal],
    goals_context: list[dict],
) -> str:
    categories_lines = []
    for c in categories:
        avg = history.get(c.id)
        avg_str = f", средние траты за последние месяцы: {avg:.0f} {currency}" if avg else ""
        if c.linked_goal_id is not None:
            kind_str = "ЦЕЛЬ НАКОПЛЕНИЯ — сумма здесь = пополнение цели, а не трата"
        elif c.is_essential:
            kind_str = "обязательная трата"
        else:
            kind_str = "не обязательная трата"
        categories_lines.append(f'- id="{c.id}", название="{c.name}" ({kind_str}){avg_str}')

    goals_lines = [
        f'- "{g["name"]}": накоплено {g["current"]:.0f} из {g["target"]:.0f} {g["currency"]}'
        for g in goals_context
    ] or ["(целей нет)"]

    return (
        f"Пользователь планирует бюджет на месяц. Доход: {total_income:.0f} {currency}.\n\n"
        f"Категории (среди них могут быть цели накопления):\n" + "\n".join(categories_lines) + "\n\n"
        f"Текущие финансовые цели пользователя:\n" + "\n".join(goals_lines) + "\n\n"
        "Распредели доход по категориям разумно, с учётом истории трат (если она есть) и "
        "здравого смысла. Обязательно выдели суммы под категории-цели накопления (если они "
        "есть в списке выше и у соответствующей цели ещё не хватает денег до её суммы) — в "
        "идеале не менее 10-20% дохода суммарно на все цели, если это реалистично при данном "
        "доходе и обязательных тратах. Не предлагай больше, чем цели не хватает до её суммы. "
        "Не превышай сумму дохода суммарно по всем категориям (траты + цели <= доход).\n\n"
        "Ответь СТРОГО в формате JSON без пояснений вне JSON, вот такой структуры:\n"
        "{\n"
        '  "items": [ { "category_id": "<id из списка выше>", "suggested_amount": <число> }, ... ],\n'
        '  "explanation": "<короткое, дружелюбное объяснение на русском языке, 2-4 предложения, '
        'без markdown>"\n'
        "}"
    )


async def get_ai_recommendation(
    total_income: Decimal,
    currency: str,
    categories: list[Category],
    history: dict[uuid.UUID, Decimal],
    goals_context: list[dict],
) -> RecommendationResponse | None:
    if not settings.DEEPSEEK_API_KEY or not categories:
        return None

    prompt = _build_prompt(total_income, currency, categories, history, goals_context)
    categories_by_id = {str(c.id): c for c in categories}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{settings.DEEPSEEK_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.DEEPSEEK_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "Ты — финансовый помощник, который помогает распределять "
                            "личный бюджет. Отвечай только валидным JSON, без markdown-разметки.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "stream": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
            raw_content = payload["choices"][0]["message"]["content"]
            parsed = json.loads(raw_content)
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        logger.warning("DeepSeek recommendation request failed, falling back to rule-based: %s", exc)
        return None

    try:
        items: list[RecommendationCategoryItem] = []
        essential_total = Decimal("0")
        lifestyle_total = Decimal("0")
        savings_total = Decimal("0")

        for raw_item in parsed.get("items", []):
            category = categories_by_id.get(str(raw_item.get("category_id")))
            if category is None:
                continue
            amount = _round_money(Decimal(str(raw_item.get("suggested_amount", 0))))
            if amount <= 0:
                continue
            if category.linked_goal_id is not None:
                bucket = "savings"
            elif category.is_essential:
                bucket = "essential"
            else:
                bucket = "lifestyle"
            items.append(
                RecommendationCategoryItem(
                    category_id=category.id,
                    category_name=category.name,
                    suggested_amount=amount,
                    bucket=bucket,
                    based_on="ai",
                )
            )
            if bucket == "essential":
                essential_total += amount
            elif bucket == "lifestyle":
                lifestyle_total += amount
            else:
                savings_total += amount

        explanation = str(parsed.get("explanation") or "").strip()

        if not items or not explanation:
            return None
    except (InvalidOperation, ValueError, TypeError) as exc:
        logger.warning("DeepSeek recommendation response failed validation, falling back: %s", exc)
        return None

    has_goal_categories = any(c.linked_goal_id is not None for c in categories)

    # Защита от "фантазий" модели: если сумма трат+сбережений превышает доход
    # — пропорционально масштабируем всё, включая сбережения.
    grand_total = essential_total + lifestyle_total + savings_total
    if grand_total > total_income and grand_total > 0:
        scale = total_income / grand_total
        for item in items:
            item.suggested_amount = _round_money(item.suggested_amount * scale)
        essential_total = _round_money(essential_total * scale)
        lifestyle_total = _round_money(lifestyle_total * scale)
        savings_total = _round_money(savings_total * scale)

    # Минимальный порог сбережений применяем только если у пользователя ЕСТЬ
    # категории целей, которые можно пополнить — иначе просто нечего скорее
    # увеличивать (нет цели == нет смысла резервировать под неё сумму).
    min_savings = _round_money(total_income * SAVINGS_FLOOR_SHARE)
    if has_goal_categories and savings_total < min_savings and (essential_total + lifestyle_total) > 0:
        shortfall = min_savings - savings_total
        scale = max(Decimal("0"), (essential_total + lifestyle_total - shortfall) / (essential_total + lifestyle_total))
        for item in items:
            if item.bucket != "savings":
                item.suggested_amount = _round_money(item.suggested_amount * scale)
        essential_total = _round_money(essential_total * scale)
        lifestyle_total = _round_money(lifestyle_total * scale)
        # Разницу от урезанных трат добавляем в первую попавшуюся категорию
        # цели (пропорционально её недостающей сумме было бы точнее, но AI
        # обычно уже сама разумно распределяет между несколькими целями).
        savings_items = [i for i in items if i.bucket == "savings"]
        if savings_items:
            bump = shortfall / len(savings_items)
            for item in savings_items:
                item.suggested_amount = _round_money(item.suggested_amount + bump)
            savings_total = min_savings

    return RecommendationResponse(
        essential_total=essential_total,
        lifestyle_total=lifestyle_total,
        savings_total=savings_total,
        items=items,
        explanation=explanation,
    )
