FROM python:3.13-slim

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/

RUN pip install --no-cache-dir .

COPY alembic.ini .
COPY alembic/ alembic/

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn pebble.main:app --host 0.0.0.0 --port 8000 --reload"]
