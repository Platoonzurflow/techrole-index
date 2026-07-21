FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install ".[dev]"
COPY . .

RUN addgroup --system app && adduser --system --ingroup app app \
    && mkdir -p /opt/dagster/dagster_home \
    && chown -R app:app /app /opt/dagster
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
