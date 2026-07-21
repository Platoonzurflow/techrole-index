# TechRole Index — правила для агентов

## Обязательные проверки

- Backend: `cd backend && ruff check . && mypy app && pytest`.
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`.
- Compose: `docker compose config --quiet`.
- Не вызывать HH API без `HH_ENABLED=true`, `HH_COMMERCIAL_USE_CONFIRMED=true`, contact email и app name.
- Не добавлять секреты. Локальные значения живут только в `.env`.
- Любое изменение прав доступа проверять тестом на отсутствие Premium-полей в free JSON.
- Все публичные страницы профессий остаются SSR и индексируемыми; Premium-метрики не попадают в HTML.

## Структура

- `backend/app/domain` — чистая бизнес-логика без I/O.
- `backend/app/providers` — законные источники данных, валют и платежей.
- `backend/app/api` — REST endpoints и серверная авторизация.
- `frontend/app` — Next.js App Router, публичные SSR-страницы и защищённые разделы.
- `infra` — production reverse proxy и эксплуатационные файлы.

## Команды

- Полный local-dev: `docker compose up --build`.
- Production-профиль: `docker compose -f compose.yaml -f compose.production.yaml --profile production up --build -d`.
- Миграции: `docker compose run --rm migrate alembic upgrade head`.
- Повторный seed: `docker compose run --rm seed python -m app.seed --force`.
- Worker: `docker compose up worker scheduler`.

