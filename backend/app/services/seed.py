"""
Скрипт заполнения базы начальными данными: системные (preset) категории
трат/доходов и набор мотивационных фраз.

Запуск (после применения миграций):
    python -m app.services.seed

Скрипт идемпотентен — повторный запуск не создаст дублей (проверяет
существование по имени/тексту перед вставкой).
"""

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.category import Category, CategoryType
from app.models.quote import MotivationalQuote

PRESET_EXPENSE_CATEGORIES = [
    # (название, иконка, цвет, обязательная трата?)
    ("Жильё и коммуналка", "home", "#FF5470", True),
    ("Продукты", "shopping-cart", "#FFB020", True),
    ("Транспорт", "car", "#2FD1C5", True),
    ("Здоровье", "heart-pulse", "#FF5470", True),
    ("Связь и интернет", "wifi", "#2FD1C5", True),
    ("Рестораны и кафе", "utensils", "#FFB020", False),
    ("Развлечения", "party-popper", "#7C5CFF", False),
    ("Одежда и обувь", "shirt", "#7C5CFF", False),
    ("Подписки", "repeat", "#5C8DFF", False),
    ("Путешествия", "plane", "#00E38C", False),
    ("Подарки", "gift", "#FF8AD8", False),
    ("Прочее", "more-horizontal", "#8A8F98", False),
]

PRESET_INCOME_CATEGORIES = [
    ("Зарплата", "wallet", "#00E38C"),
    ("Фриланс/подработка", "laptop", "#5C8DFF"),
    ("Инвестиции", "trending-up", "#7C5CFF"),
    ("Подарки/прочее", "gift", "#FFB020"),
]

MOTIVATIONAL_QUOTES = [
    ("Маленькие шаги каждый день приводят к большим переменам в финансах.", None, "general"),
    ("Каждый отложенный рубль — это ты, который заботится о будущем себе.", None, "general"),
    ("Бюджет — это не про ограничения, а про то, что для тебя важнее.", None, "general"),
    ("Ты уже сделал первый шаг — начал следить за деньгами. Это половина успеха.", None, "general"),
    ("Финансовая свобода строится не за один день, а за счёт постоянства.", None, "general"),
    ("Сегодняшний контроль трат — это твоя спокойная жизнь завтра.", None, "on_track"),
    ("Отлично! Ты укладываешься в план — продолжай в том же духе.", None, "on_track"),
    ("Небольшое превышение бюджета — не повод сдаваться. Скорректируй курс и иди дальше.", None, "overspend"),
    ("Ошибки в тратах — это просто данные для более точного плана на следующий месяц.", None, "overspend"),
    ("Ты всё ближе к своей цели. Каждый вклад имеет значение.", None, "goal_progress"),
    ("Твоя цель становится реальнее с каждым отложенным рублём.", None, "goal_progress"),
    ("Деньги любят тех, кто умеет их планировать.", None, "general"),
]


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        existing_names = set(
            (await session.execute(select(Category.name).where(Category.is_preset.is_(True)))).scalars().all()
        )

        for name, icon, color, is_essential in PRESET_EXPENSE_CATEGORIES:
            if name in existing_names:
                continue
            session.add(
                Category(
                    user_id=None,
                    name=name,
                    type=CategoryType.EXPENSE,
                    icon=icon,
                    color=color,
                    is_preset=True,
                    is_essential=is_essential,
                )
            )

        for name, icon, color in PRESET_INCOME_CATEGORIES:
            if name in existing_names:
                continue
            session.add(
                Category(
                    user_id=None,
                    name=name,
                    type=CategoryType.INCOME,
                    icon=icon,
                    color=color,
                    is_preset=True,
                    is_essential=False,
                )
            )

        existing_quotes = set((await session.execute(select(MotivationalQuote.text))).scalars().all())
        for text, author, category in MOTIVATIONAL_QUOTES:
            if text in existing_quotes:
                continue
            session.add(MotivationalQuote(text=text, author=author, category=category))

        await session.commit()
        print("Seed завершён: категории и мотивационные фразы добавлены (если их ещё не было).")


if __name__ == "__main__":
    asyncio.run(seed())
