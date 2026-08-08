FROM python:3.12-slim

WORKDIR /app

# Системные зависимости для сборки некоторых Python-пакетов (например bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# При старте контейнера: применяем миграции, заполняем стартовые данные,
# затем запускаем сервер. Для продакшна замените --reload на несколько
# воркеров, например: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
CMD ["sh", "-c", "alembic upgrade head && python -m app.services.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
