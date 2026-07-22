# TechRole Index

[![CI](https://github.com/Platoonzurflow/techrole-index/actions/workflows/ci.yml/badge.svg)](https://github.com/Platoonzurflow/techrole-index/actions/workflows/ci.yml)
[![Secret scan](https://github.com/Platoonzurflow/techrole-index/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/Platoonzurflow/techrole-index/actions/workflows/secret-scan.yml)
[![Public preview](https://github.com/Platoonzurflow/techrole-index/actions/workflows/public-preview.yml/badge.svg)](https://github.com/Platoonzurflow/techrole-index/actions/workflows/public-preview.yml)

[Открыть сайт](https://win-702hpohbtiv.tail044b19.ts.net) · [Daily dataset](https://win-702hpohbtiv.tail044b19.ts.net/open-data-daily) · [Как цитировать](https://win-702hpohbtiv.tail044b19.ts.net/citation) · [RFC 9264 Linkset](https://win-702hpohbtiv.tail044b19.ts.net/.well-known/linkset.json)

Полный контекст текущего состояния, история работ и план продолжения для нового чата находятся в [`HANDOFF.md`](HANDOFF.md). Описание публикуемого набора, ограничений и правил атрибуции вынесено в [`DATASET_CARD.md`](DATASET_CARD.md).

Рабочий MVP русскоязычного сервиса аналитики рынка IT-профессий. Текущий публичный release — [`0.1.0`](CHANGELOG.md). Он показывает спрос, зарплаты, Junior/Middle/Senior, выборку, confidence, 7/30/90-дневные тренды, типичный технологический стек и объяснимый индекс 0–100. Базовая gross-витрина воспроизводимо подготовлена для 50 профессий, 4 геосрезов и 180 дней. Реальные записи официального открытого API «Работа России» показываются отдельным provenance-контуром: точные публикации профессии и публикации её направления видны отдельными недельными рядами, а salary midpoint публикуется только с достаточной выборкой. Третий слой показывает фактические доходы из открытых исследований с явными scope, периодом, налоговым статусом и источником: ролевые данные Хабр Карьеры дополнены проверяемыми грейдовыми исследованиями, поэтому Junior/Middle/Senior заполнены для всех 50 профессий — 150 из 150 карточек.

> Коммерческое использование данных API конкретного правообладателя может требовать отдельного письменного разрешения. Наличие `HhApiProvider` не означает, что такое разрешение получено. По умолчанию provider выключен.

## Архитектура

- Next.js 16 + TypeScript + App Router + Tailwind + Apache ECharts: SSR публичных страниц, адаптивный UI, light/dark.
- FastAPI + Pydantic + SQLAlchemy + Alembic: REST API, OpenAPI, auth и серверный paywall.
- PostgreSQL: основная БД, подготовленные daily-метрики и изолированная `observed_publication_metrics_daily` с partition upsert/quality gate. `AnalyticsSink` подготовлен для будущего ClickHouse.
- Redis + Celery worker/beat: очередь обращений, fail-open cache каталога/detail с коротким TTL и прикладные фоновые задачи.
- Dagster webserver + daemon: nightly ingestion в `00:00 Europe/Moscow`, история запусков, email-отчёт и зависимый materialization op только после успешного ingestion.
- Официальный XML Банка России: отключаемый real currency provider и replayable snapshots requested/effective date для USD/EUR/KZT.
- Caddy: production reverse proxy и security headers.
- Контейнеры local-dev: `frontend`, `backend`, `worker`, `scheduler`, `dagster-webserver`, `dagster-daemon`, `postgres`, `redis`; одноразовые `migrate` и `seed`.
- CI: Ruff, mypy, pytest, ESLint, TypeScript, Vitest, production build, Compose, rendered production security contract, Gitleaks по полной истории и отдельный Chromium E2E job; Dependabot подготовлен для трёх экосистем.
- Prometheus-compatible observability: внутренний `/metrics`, bounded route-template labels, multiprocess Gunicorn storage и отдельный loopback-only профиль с alert rules.
- Windows public preview: production standalone на 3100 стоит за постоянным loopback Node proxy на 3199, поэтому SSH сохраняет локальный listener при переключении immutable build slot; отдельный refresh отслеживает возможную ротацию временного hostname самим провайдером.

Подробности: [ARCHITECTURE.md](ARCHITECTURE.md), формулы: [METHODOLOGY.md](METHODOLOGY.md), решения: [DECISIONS.md](DECISIONS.md), платежи и действия владельца: [PAYMENTS.md](PAYMENTS.md), варианты размещения: [HOSTING.md](HOSTING.md), белая стратегия запуска: [GROWTH.md](GROWTH.md), вклад в проект: [CONTRIBUTING.md](CONTRIBUTING.md), приватное сообщение об уязвимости: [SECURITY.md](SECURITY.md).

## Быстрый запуск

Требуются Docker Desktop с Compose v2 и свободные loopback-порты 3000/3001/8000.

```powershell
Copy-Item .env.example .env
# Обязательно замените APP_SECRET_KEY и demo-пароли в .env.
docker compose up --build
```

После успешного запуска:

- сайт: <http://localhost:3000>;
- API: <http://localhost:8000/api/v1>;
- OpenAPI UI: <http://localhost:8000/docs>;
- Dagster: <http://localhost:3001>;
- admin UI: <http://localhost:3000/admin>;
- заявка на личное ведение: <http://localhost:3000/mentorship>;
- техподдержка: <http://localhost:3000/support>;
- статус сервиса: <http://localhost:3000/status>;
- статус и происхождение данных: <http://localhost:3000/data-status>, <http://localhost:3000/data-status.json>;
- методические разборы: <http://localhost:3000/insights>, <http://localhost:3000/insights.json>; каждая Article page публикует собственные CSL-JSON, BibTeX и RIS через ссылки `/cite/*`;
- открытый daily dataset и машиночитаемые материалы: <http://localhost:3000/open-data-daily>, <http://localhost:3000/open-data-daily.json>, <http://localhost:3000/open-data-daily.csv>, <http://localhost:3000/open-data-daily.csv-metadata.json>, <http://localhost:3000/open-data-daily.schema.json>, <http://localhost:3000/open-data-daily.croissant.json>, <http://localhost:3000/catalog.jsonld>, <http://localhost:3000/.well-known/linkset.json>, <http://localhost:3000/llms.txt>, <http://localhost:3000/.well-known/llms.txt>, <http://localhost:3000/llms-full.txt>, <http://localhost:3000/ai-index.json>, <http://localhost:3000/open-data.json>, <http://localhost:3000/open-data.csv>, <http://localhost:3000/feed.xml>;
- цитирование и переносимые метаданные: <http://localhost:3000/citation>, <http://localhost:3000/citation.json>, <http://localhost:3000/citation.bib>, <http://localhost:3000/citation.ris>, <http://localhost:3000/datapackage.json>.

Для публичного GitHub также подготовлен корневой [`CITATION.cff`](CITATION.cff); канонический URL берите с `/citation`, потому что временные preview-host меняются.

Daily JSON/CSV/Schema публикуют SHA-256 `ETag`; JSON и CSV также отдают `Last-Modified`. Клиенты могут использовать `If-None-Match` или `If-Modified-Since` и получать пустой `304 Not Modified`, когда материализация не изменилась.

PostgreSQL и Redis не публикуют порты на host. Backend и frontend доступны только на loopback в local-dev.

Локальный Prometheus UI поднимается отдельно на <http://127.0.0.1:9090>:

```powershell
docker compose -f compose.yaml -f compose.observability.yaml --profile observability up -d prometheus
```

Метрики не проходят через публичный frontend/Caddy. Alert rules проверяют недоступность backend, долю 5xx и p95 latency; внешняя доставка требует отдельно настроенного Alertmanager.

Форма личного ведения отправляется внутри сайта через отдельный endpoint `/api/v1/mentorship/requests`, сохраняет заявку с номером и передаёт её собственной Celery-задаче. Письма личного ведения имеют префикс `[TechRole Mentorship]`, а обращения поддержки - `[TechRole Support]`.

Обе формы сохраняются в PostgreSQL и используют общую заменяемую SMTP-инфраструктуру, но разные таблицы, API, задачи и шаблоны писем. По умолчанию SMTP выключен, чтобы проект не содержал почтовых секретов. Для реальной доставки на `sqldevelopermoscow@yandex.com` добавьте пароль приложения почтового ящика только в локальный `.env` и включите доставку:

```dotenv
SUPPORT_EMAIL_ENABLED=true
SUPPORT_RECIPIENT_EMAIL=sqldevelopermoscow@yandex.com
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USERNAME=sqldevelopermoscow@yandex.com
SMTP_PASSWORD=<пароль-приложения>
SMTP_FROM_EMAIL=sqldevelopermoscow@yandex.com
SMTP_USE_SSL=true
```

В настройках Яндекс Почты также должен быть включён доступ почтовых программ: «С сервера imap.yandex.ru по протоколу IMAP» и «Пароли приложений и OAuth-токены». После изменения перезапустите backend, worker, scheduler и Dagster: `docker compose up -d --build backend worker scheduler dagster-webserver dagster-daemon`. Обычный пароль от почты использовать не следует; `SMTP_PASSWORD` никогда не коммитится.

На локальной машине владельца 2026-07-19 доставка включена и проверена end-to-end: IMAP подтвердил пять писем с отдельными префиксами `[TechRole Support]`, `[TechRole Mentorship]` и `[TechRole Nightly]`. Это состояние локального `.env`; секреты в репозиторий не добавлены.

## Миграции и demo-данные

Обычный `docker compose up` сначала запускает `alembic upgrade head`, затем идемпотентный seed.

```powershell
docker compose run --rm migrate alembic upgrade head
docker compose run --rm migrate alembic current
docker compose run --rm seed python -m app.seed
docker compose exec -T backend python -m app.materialize_publication_metrics --source trudvsem_open
# Полное пересоздание только demo-БД:
docker compose run --rm seed python -m app.seed --force
```

Seed фиксирован `DEMO_SEED=20260717`, заканчивается snapshot-датой 2026-07-17 и включает рост, падение, нейтральные роли, пропуски зарплаты, RUB/USD/EUR/KZT и редкие профессии с `insufficient`.

## Demo-пользователи

Создаются только при `DEMO_MODE=true`. Email:

- `free@example.com`;
- `premium@example.com`;
- `admin@example.com`.

Пароли берутся из `DEMO_FREE_PASSWORD`, `DEMO_PREMIUM_PASSWORD`, `DEMO_ADMIN_PASSWORD` в локальном `.env`. Значения из `.env.example` предназначены только для первого локального запуска и должны быть заменены. Хеши Argon2 сохраняются в БД, открытые пароли — нет.

## Команды разработки

Backend без Docker:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e "backend[dev]"
Set-Location backend
..\.venv\Scripts\alembic upgrade head
..\.venv\Scripts\python -m app.seed
..\.venv\Scripts\uvicorn app.main:app --reload
```

Frontend:

```powershell
Set-Location frontend
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Worker/scheduler:

```powershell
docker compose up worker scheduler
```

Nightly ingestion и наблюдение:

```powershell
docker compose up -d dagster-webserver dagster-daemon
docker compose exec -T dagster-webserver dagster schedule list -w workspace.yaml
# UI истории запусков и ручного старта:
Start-Process http://localhost:3001
```

Безопасная повторная классификация уже загруженных официальных публикаций:

```powershell
docker compose exec -T backend python -m app.reclassify_open_data --dry-run
docker compose exec -T backend python -m app.reclassify_open_data --apply
```

Команда не перезаписывает AI- или ручные решения. Текущий `rules-v2` увеличил rule-based покрытие с 1 050 до 1 130 записей без очисток; вместе с двумя сохранёнными AI-решениями представлены 36 из 50 профессий.

Расписание `techrole_midnight_moscow` использует cron `0 0 * * *` и timezone `Europe/Moscow`, поэтому не зависит от UTC внутри контейнера. При включённом `NIGHTLY_REPORT_EMAIL_ENABLED=true` результат имеет отдельную тему `[TechRole Nightly] ...`; неуспех почты фиксируется в результате, но не скрывает итог ingestion.

Тесты и статические проверки:

```powershell
Set-Location backend
..\.venv\Scripts\ruff check .
..\.venv\Scripts\mypy app
..\.venv\Scripts\pytest

Set-Location ..\frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm prepare:standalone
pnpm test:e2e
pnpm audit:public

Set-Location ..
docker compose config --quiet
docker compose --profile local-dev run --rm dev-tests
# Изолированный Chromium runner, не запускается в обычном окружении:
docker compose --profile e2e run --rm e2e
# Проверка всех canonical HTML URL из sitemap внутри запущенного frontend:
docker compose exec -T frontend npm run audit:public
```

## Тестовый контур платежей

`DemoPaymentProvider` проводит полный sandbox-сценарий без списания: сервер формирует продукт и цену, сохраняет заказ и версию принятых условий, проверяет HMAC webhook/idempotency и только после `succeeded` выдаёт отдельный entitlement на 30 дней. Отмена терминальна; полный административный возврат идемпотентен и отзывает только доступ этого заказа.

После подтверждения владельцем статуса самозанятого НПД основной кандидат — Robokassa с «Робочеками СМЗ», резервный — ЮKassa. Оба адаптера определяют товар и сумму на сервере. Robokassa создаёт подписанный redirect и чек, проверяет подпись ResultURL, дедуплицирует повторы и сверяет live-возвраты; ЮKassa использует REST idempotency и авторизованную перепроверку webhook. Без test credentials провайдеров выполнены только локальные и mock-контракты. Live-режим заблокирован до личной регистрации/KYC, постоянного HTTPS-host, утверждённых реквизитов и явного подтверждения владельца. Сравнение, безопасные переменные и инструкция: [PAYMENTS.md](PAYMENTS.md).

## Подключение законного источника

1. Получить и документировать право использования данных.
2. Реализовать/настроить `VacancyDataProvider`, не меняя расчётный слой.
3. Для официального HH API заполнить contact/app name и только после письменного подтверждения установить одновременно:

```dotenv
HH_ENABLED=true
HH_COMMERCIAL_USE_CONFIRMED=true
HH_CONTACT_EMAIL=owner@example.com
HH_APP_NAME=TechRoleIndex
```

Provider использует официальный API, `HH-User-Agent`, одну страницу до 100 элементов и не обходит rate limit, CAPTCHA или глубину выдачи. Не включайте флаг только потому, что код технически работает. Условия: [DATA_SOURCES.md](DATA_SOURCES.md).

Для чернового законного контура реализован `TrudvsemOpenDataProvider`, который читает только официальный JSON API портала «Работа России»:

```dotenv
TRUDVSEM_ENABLED=true
TRUDVSEM_QUERY_LIMIT=100
TRUDVSEM_MAX_PROFESSIONS=50
TRUDVSEM_HISTORY_DAYS=180
TRUDVSEM_MAX_PAGES_PER_QUERY=100
TRUDVSEM_USE_ALIAS_QUERIES=true
TRUDVSEM_REQUEST_DELAY_SECONDS=0.25
```

Provider сохраняет только allowlist профессиональных полей и не сохраняет контакты/адреса. Налоговый статус зарплаты считается неизвестным; поэтому ingestion хранит наблюдения и provenance, но не перезаписывает публичную gross-витрину. Публичный 180-дневный ряд показывает публикации по `creation-date`, а не историю одновременно активных вакансий. HTML-скрейпинг не используется.

Отдельный публичный зарплатный слой считает RUB midpoint только по двум границам, отдельно для Junior/Middle/Senior и при минимуме 20 полных вилок. История использует 30-дневные окна с недельным шагом. На странице профессии остаётся один комплект грейдовых карточек: официальный ролевой midpoint с достаточной выборкой имеет приоритет, иначе выбирается наиболее точный открытый исследовательский ориентир; это выбор по качеству источника, а не по наибольшей сумме. Фактический `n`, период, scope и налоговый статус сохраняются рядом со значением.

### Публичные ориентиры фактических доходов

`backend/app/data/salary_benchmarks.py` хранит версионированные факты из публичных отчётов отдельно от vacancy observations. Главный источник — [Хабр Карьера, I полугодие 2026](https://habr.com/ru/specials/1060148/), `n=45 226`: ролевые P10/median/P90, медианы технологий и значения Москва/Санкт-Петербург/другие регионы. Для грейдов используются отдельно помеченные публикации [Хабр Карьеры о Junior](https://habr.com/ru/companies/habr_career/articles/1040188/), [Grades/GetGrade 2025](https://habr.com/ru/articles/981704/) и [опрос Профсоюза работников ИТ за I полугодие 2026](https://ruitunion.org/posts/2026-05-29-salaries/) с 1 539 российскими ответами. Последний даёт только общерыночные медианы Junior 114 500 ₽, Middle 200 000 ₽ и Senior 310 000 ₽; gross/net не указан, поэтому он используется только для отсутствующих ролевых грейдов и всегда подписывается как общий IT-рынок. Дополнительно сохранён датированный снимок восьми точных ролевых медиан, которые официальный [калькулятор Хабр Карьеры](https://career.habr.com/salaries) публично сообщает в SEO-описании отфильтрованных страниц; скрытые входом значения не извлекались, а `n` и gross/net остаются неизвестными.

Порядок интерпретации строгий: точная профессия → технологический или смежный срез → категорийный fallback. P10/P90 не выдаются за Junior/Senior, категорийная медиана не становится ролевой, а исследование фактических доходов не записывается в таблицы вилок вакансий. У всех 50 профессий есть Россия и три геосреза категории; 37 получили прямой срез, 11 — явно смежный, только 2 — категорийный ориентир.

Опциональный Dagster op `verify_public_salary_benchmarks` проверяет только публичные `title` и `meta description`, никогда не входит в аккаунт и не меняет снимок автоматически. Подтверждённое изменение метаданных останавливает op; временная недоступность источника отмечается отдельно и не выдаётся за изменение числа. Включение: `SALARY_SOURCE_AUDIT_ENABLED=true`. Ручная проверка:

Каждый включённый запуск сохраняет итог в существующий PostgreSQL `audit_logs`. Публичный `/status` показывает время последней проверки и счётчики `verified/changed/unavailable`, но не публикует внутренние логи и не принимает результат проверки от браузера.

Отдельная страница `/salary-benchmarks` собирает этот справочный слой по всем 50 профессиям и даёт переносимые `/salary-benchmarks.json` и `/salary-benchmarks.csv`. JSON дополнительно сообщает покрытие грейдов `50` профессий / `150` точек. В выгрузках остаются coverage (`direct`/`related`/`category`), география, метрика, период, `n`, tax status, первичный URL и методология. Это не открытая лицензия на материалы источников: дальнейшее использование сверяется с условиями каждого первичного источника.

```powershell
docker compose exec -T backend python -m app.services.salary_source_audit
```

Ручной запуск официального слоя:

```powershell
docker compose exec -T backend python -c "from app.database import SessionLocal; from app.services.open_data_ingestion import ingest_trudvsem_open_data; db=SessionLocal(); print(ingest_trudvsem_open_data(db).to_dict()); db.close()"
```

## Optional Ollama

Основной классификатор rule-based и не требует GPU. Ollama включается только для неопределённых записей:

```dotenv
AI_CLASSIFIER_ENABLED=true
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=<локальная-модель>
```

Запуск профильного helper: `docker compose --profile ai up`. Для интерактивной работы выбирайте модель, которая помещается в доступные ~8 ГБ VRAM; более крупная модель использует медленный CPU/RAM fallback. Ответ AI получает потолок confidence 0.79 и не заменяет ручную проверку.

На проектной Windows-машине 2026-07-18 установлена `qwen3.6:27b` Q4_K_M (17 ГБ). В 4K-проверке она дала правильный структурированный ответ, но работала с распределением примерно 70% CPU / 30% GPU и почти полностью заняла 32 ГБ RAM и 8 ГБ VRAM. Это максимальная по качеству локальная модель для редких или ночных задач, а не для быстрого интерактива: холодный короткий запрос занял 79 секунд, генерация - около 1,46 токена/с. Docker-контейнер успешно получил от неё валидную классификацию `nlp-engineer`. В локальной конфигурации AI разрешён только для максимум трёх неопределённых вакансий за nightly-run, confidence ограничен 0.79, slug проверяется по каталогу, а после запуска модель выгружается из памяти.

Воспроизводимый доменный benchmark использует 20 синтетических русскоязычных кейсов без реальных вакансий и персональных данных. Он проверяет строгий JSON Schema, близкие IT-роли, seniority и обязательное воздержание на трёх нецелевых вакансиях. Запуск из PowerShell:

```powershell
$workspace = (Get-Location).Path
docker compose run --rm --no-deps -v "$workspace\outputs:/outputs" backend python -m app.ai_benchmark --model qwen3.6:27b --output /outputs/ai-classifier-report.json
```

Контрольный прогон 2026-07-21 завершился за 276,4 секунды: schema/slug/seniority/exact — `20/20`, корректные отказы — `3/3`. Первый холодный кейс занял 40,2 с, последующие — 10–14 с; после прогона `ollama ps` подтвердил выгрузку модели. Это ограниченный synthetic quality gate, а не доказательство качества на будущих реальных распределениях: rule-based классификатор и ручная проверка остаются главными.

Официальные сведения: [Ollama qwen3.6:27b](https://ollama.com/library/qwen3.6:27b), [Qwen3.6-27B model card и benchmarks](https://huggingface.co/Qwen/Qwen3.6-27B), [Ollama v0.32.1](https://github.com/ollama/ollama/releases/tag/v0.32.1).

## Production

```powershell
docker compose -f compose.yaml -f compose.production.yaml --profile production up --build -d
```

Перед запуском установите сильный `APP_SECRET_KEY`, `DEMO_MODE=false`, один HTTPS origin в `SITE_ADDRESS`/`PUBLIC_BASE_URL`/`FRONTEND_ORIGIN`/`NEXT_PUBLIC_SITE_URL` и отдельные согласованные `POSTGRES_*`/`DATABASE_URL` credentials. Используйте пустую production-БД: local demo volume намеренно отвергается. Production override убирает все host-порты кроме Caddy 80/443, исключает source bind-mounts и передаёт canonical URL как Docker build arg. Rendered config проверьте через `infra/validate-production-config.mjs`. См. [DEPLOYMENT.md](DEPLOYMENT.md) и [SECURITY.md](SECURITY.md).

## Типичные проблемы Windows / Docker Desktop

- `docker` не найден: запустите Docker Desktop, включите WSL2 backend, перезапустите терминал и проверьте `docker compose version`.
- Bind mount медленный: храните репозиторий в WSL2 filesystem либо исключите каталог `node_modules` из антивирусного real-time scan согласно политике организации.
- pnpm долго перестраивает ссылки: используйте Node 22/Corepack и `pnpm install --frozen-lockfile`; не смешивайте npm и pnpm в одном `node_modules`.
- Порты заняты: `Get-NetTCPConnection -LocalPort 3000,8000`; остановите конфликтующий local service.
- Seed кажется зависшим: он вставляет 108 000 daily-срезов; дождитесь строки `Seeded 50 professions` и проверьте `docker compose logs seed`.
- Docker не видит Ollama: разрешите localhost listener Ollama и используйте `host.docker.internal:11434`; AI всё равно можно оставить выключенным.
