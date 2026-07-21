# Архитектура

## Потоки

1. `VacancyDataProvider` отдаёт нормализованные записи без персональных данных соискателей.
2. Rule-based classifier нормализует title, применяет алиасы/regex/exclusions/experience/seniority и сохраняет confidence + version.
3. `CurrencyRateProvider` сохраняет исходную валюту, курс, requested/effective date и нормализованные границы; midpoint появляется только для полной вилки. Официальные CBR rates живут в `currency_rate_snapshots`, demo rates остаются детерминированными.
4. Dagster запускает в 00:00 по Москве отдельные ops официальных currency snapshots и open-data ingestion; Celery обслуживает прикладные очереди, а расчётный слой формирует snapshots/observations, SQL-friendly `profession_metrics_daily` и версионируемые `profession_scores_daily`.
5. FastAPI применяет entitlement до сериализации ответа. Free не получает Premium-поля.
6. Next.js SSR запрашивает уже урезанный контракт, поэтому закрытые значения не попадают в HTML/metadata.
7. Публичный provenance-контракт маркирует подготовленную gross-витрину как `prepared_baseline`, а официальный ряд как `observed_historical`; оба слоя запрещают утверждение о live-состоянии рынка.

## Границы модулей

- `app/domain`: чистая классификация, salary, trends, scoring.
- `app/providers`: вакансии, валюты, платежи, optional AI, analytics sink.
- `app/services/open_data_ingestion.py`: транзакционный ingestion официальных открытых записей, provenance и privacy allowlist.
- `app/services/currency_rates.py`: идемпотентные snapshots официальных дневных курсов без автоматического смешивания gross/net basis.
- `app/services/cache.py`: JSON cache с SHA-256 ключами, коротким TTL, public/premium namespace parts и fail-open поведением.
- `app/dagster_defs.py`: job, op и schedule `0 0 * * *` в `Europe/Moscow`; Dagster webserver/daemon имеют общий persistent home.
- `app/api`: HTTP, Pydantic validation, auth, admin, paywall.
- `app/observability.py`: Prometheus counter/histogram только по method, route template и status class; фактические path/query/user значения не являются labels.
- `app/models.py`: транзакционная и аналитическая PostgreSQL-модель.
- `frontend/app`: маршруты App Router; публичные страницы SSR, защищённые страницы noindex.
- `frontend/app/data-status*` и `open-data.csv`: видимое объяснение слоёв и плоская воспроизводимая выгрузка 50 профессий × 3 уровня без Premium-полей.
- `infra/public-proxy.mjs`: минимальный loopback reverse proxy для Windows preview; сохраняет listener на 3199 во время recreate standalone upstream на 3100 и отбрасывает client-IP forwarding headers.

## Данные

Модель включает все MVP-таблицы: `professions`, `profession_aliases`, `profession_categories`, `seniority_levels`, `regions`, `vacancy_sources`, `source_queries`, `vacancies`, `vacancy_skills`, `vacancy_snapshots`, `salary_observations`, `currency_rate_snapshots`, `profession_metrics_daily`, `profession_scores_daily`, `ingestion_runs`, `scoring_versions`, `users`, `subscriptions`, `entitlements`, `payment_orders`, `payment_refunds`, `payment_events`, `audit_logs`, обращения `support_requests`, заявки `mentorship_requests`, а также Premium-правила `notification_rules`.

Формы поддержки и личного ведения используют независимые REST-контуры: отдельные anonymous double-submit CSRF cookies, origin check, Redis rate limit, honeypot, разные таблицы и идемпотентные Celery-задачи через абстракцию `EmailProvider`. SMTP является общей конфигурацией окружения; при его отсутствии заявка остаётся в базе и может быть доставлена после настройки.

Уникальность вакансии: `(source_id, external_id)`. Daily-метрика уникальна по дате, профессии, seniority, region и gross/net basis.

## Масштабирование

PostgreSQL достаточен для MVP. `AnalyticsSink` позволяет добавить ClickHouse без изменения provider/classifier/API. Redis cache catalog/detail уже подключён; следующий storage-шаг — инкрементальные SQL-модели. GPU не участвует в критическом пути: большая Ollama включается только для ограниченного числа неопределённых nightly-записей и выгружается после run.

## Ресурсы

Compose memory limits дают менее 12 ГБ суммарного лимита для стандартного local-dev с Dagster. Worker concurrency=2 подходит 6-ядерному CPU. GPU не резервируется. Optional Ollama живёт на host, не входит в Compose-лимит и может кратковременно занять почти всю доступную host RAM/VRAM.

Prometheus является optional-профилем с loopback-портом и 15-дневным локальным retention. Production Gunicorn использует `PROMETHEUS_MULTIPROC_DIR` в tmpfs и `child_exit` cleanup, чтобы два workers не публиковали конфликтующие process-local ряды.
