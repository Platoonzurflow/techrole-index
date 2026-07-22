# TechRole Index - полный handoff проекта

Последнее обновление: 2026-07-21, Europe/Moscow.

Этот файл предназначен для нового чата или разработчика, который продолжит проект без истории текущего диалога. Перед любыми изменениями необходимо полностью прочитать `AGENTS.md`, затем этот файл, `DECISIONS.md` и профильный документ из списка ниже.

## 1. Что это за продукт

TechRole Index - русскоязычный веб-сервис аналитики рынка IT-профессий. Пользователь изучает роли, сравнивает спрос, зарплаты и динамику по уровням Junior/Middle/Senior, смотрит индекс 0-100, технологический стек, рейтинг и историю показателей.

Сервис также включает:

- публичный каталог и индексируемые страницы 50 профессий;
- бесплатный и Premium-доступ с серверным paywall;
- сравнение 2-3 профессий, Premium-дашборд, CSV и уведомления;
- регистрацию, авторизацию и личный кабинет;
- административную панель;
- заявку на персональное ведение до офера через почту;
- страницу методологии, источников и статуса данных;
- SEO, sitemap, robots.txt, расширенный JSON-LD, `/llms.txt`, `/llms-full.txt`, `/ai-index.json`, glossary и editorial policy.

Важно: текущая базовая gross-витрина детерминированно подготовлена и не должна выдаваться за полностью актуальное состояние рынка. 2026-07-19 выполнен полный разрешённый 180-дневный проход отдельного real-provenance контура официального API «Работа России»; nightly продолжает обновление. После безопасной повторной классификации `rules-v2` materialized dataset за 2026-01-21..2026-07-20 содержит 1 132 классифицированные публикации и 742 изолированных daily SQL-среза версии `observed-publications-v1`; invalid slices и salary leaks ниже `n=20` равны нулю. Rolling API на 2026-07-21 использует 180 полных UTC-дней 2026-01-23..2026-07-21: 5 646 записей источника, 1 278 классифицированных и 1 268 с раскрытой зарплатой. Накопительная materialized history сохраняет собственный более ранний cut-off. Неизвестный gross/net не смешивается с основной gross-витриной. HH не включён и не вызывался.

2026-07-21 добавлен третий независимый зарплатный слой. Последний отчёт Хабр Карьеры за I полугодие 2026 (`n=45 226`) даёт публичные P10/median/P90, технологии и региональные медианы; отдельные грейды дополнены публичными статьями Хабр Карьеры и Grades/GetGrade с сохранением `n` и tax status. 2026-07-22 из публичных SEO-описаний калькулятора Хабр Карьеры добавлены только открытые медианы: восемь точных ролей и два явно смежных ориентира — ML-разработчик для NLP, ERP-программист для SAP. Скрытые распределения не извлекались, `n` и gross/net помечены неизвестными. Общий опрос Профсоюза работников ИТ (`n=1 539`) закрывает только отсутствующие грейды явно подписанными медианами рынка: Junior 114 500 ₽, Middle 200 000 ₽, Senior 310 000 ₽. В итоге все 50 профессий имеют 150 из 150 грейдовых значений; основной ролевой срез составляет 37 прямых и 13 смежных, category-only ролей нет. На profession page они выводятся одним комплектом Junior/Middle/Senior: официальный midpoint с `n≥20` имеет приоритет, иначе берётся наиболее точный исследовательский срез; прежние повторные карточки prepared/official слоёв удалены, а динамические графики сохранены отдельно. Опциональный Dagster-аудит проверяет только публичные метаданные, не обновляет числа автоматически и отличает drift от временной недоступности; итог каждого включённого запуска сохраняется в PostgreSQL и кратко показывается на `/status`. `/salary-benchmarks`, JSON и CSV публикуют весь слой с provenance и без Premium-полей, но не объявляют единую открытую лицензию вместо условий первичных источников. Значения доступны даже на teaser-страницах, не участвуют в score и не записываются в vacancy metrics.

«Работа России» - самостоятельная государственная open-data база, а не данные hh.ru. На момент проверки официальный API сообщал 538 722 вакансии во всей базе. После `rules-v2` представлены 36 из 50 профессий; для 14 узких профессий уверенных совпадений нет, и точные нули оставлены честными. На profession page рядом показывается сумма и недельный ряд всего направления, но они не прибавляются к профессии. API не даёт статуса на каждый исторический день, поэтому 180-дневный ряд означает публикации по `creation-date`, а не одновременно активные вакансии.

## 2. Где находится проект и что сейчас запущено

Рабочий каталог Windows:

`<workspace>\full-stack-data-engineer-ux-mvp`

Локальные адреса:

- сайт: `http://localhost:3000/`;
- backend API: `http://localhost:8000/`;
- Swagger/OpenAPI: `http://localhost:8000/docs`;
- JSON OpenAPI: `http://localhost:8000/openapi.json`;
- админ-панель: `http://localhost:3000/admin`;
- Dagster: `http://localhost:3001`.

На момент handoff контейнеры `frontend`, `backend`, `worker`, `scheduler`, `dagster-webserver`, `dagster-daemon`, `postgres` и `redis` настроены. PostgreSQL и Redis не опубликованы на host; наружу в local-dev доступны только `127.0.0.1:3000`, `127.0.0.1:3001` и `127.0.0.1:8000`. Dagster schedule называется `techrole_midnight_moscow`, cron `0 0 * * *`, timezone `Europe/Moscow`, default status `RUNNING`.

Проект является Git-репозиторием на ветке `main`. Baseline commit `d2c6ed0` фиксирует исходное состояние; локальная identity записана как `Codex Agent <codex@localhost>`. `.env`, pnpm store, node_modules, Next dist, TypeScript cache, Celery schedule и backups игнорируются. Продолжение 2026-07-20 фиксируется отдельными проверенными commits, а не изменением baseline.

## 3. Технологии

Frontend:

- Next.js 16, TypeScript, App Router;
- React 19;
- Tailwind CSS;
- Lucide Icons;
- Apache ECharts;
- SSR публичных страниц;
- Vitest + Testing Library;
- Playwright E2E-сценарии.

Backend:

- Python 3.12;
- FastAPI и автоматически формируемая OpenAPI;
- SQLAlchemy 2;
- Alembic;
- Pydantic Settings;
- PostgreSQL 16;
- Redis 7;
- Celery worker + Celery Beat;
- Dagster 1.13 + dagster-webserver для nightly orchestration;
- Argon2 через `pwdlib`, JWT в HttpOnly cookie.

Инфраструктура:

- Docker Compose;
- отдельные контейнеры frontend/backend/worker/scheduler/PostgreSQL/Redis;
- Caddy для production-профиля;
- health checks и memory limits;
- production overlay `compose.production.yaml`;
- GPU не обязателен.

## 4. Структура репозитория

Корневые документы:

- `README.md` - назначение, быстрый запуск, пользователи, команды и типовые проблемы;
- `AGENTS.md` - обязательные команды и правила для агентов;
- `ARCHITECTURE.md` - потоки и границы модулей;
- `METHODOLOGY.md` - зарплаты, тренды, score и классификация;
- `DECISIONS.md` - журнал архитектурных и продуктовых решений;
- `SECURITY.md` - модель безопасности;
- `DATA_SOURCES.md` - провайдеры и юридические ограничения;
- `DEPLOYMENT.md` - local/production, backup и restore;
- `HOSTING.md` - актуальная матрица бесплатного размещения, Funnel preview и путь на OCI/VPS;
- `GROWTH.md` - белая стратегия индексации, цитирования и содержательного продвижения;
- `CONTRIBUTING.md` и `.github/ISSUE_TEMPLATE` - правила проверяемого вклада и безопасное сообщение об ошибке данных;
- `.env.example` - безопасный шаблон окружения;
- `HANDOFF.md` - текущий файл.

Backend:

- `backend/app/domain/` - чистая бизнес-логика без I/O:
  - `classifier.py` - объяснимая классификация профессии и seniority;
  - `salary.py` - статистика зарплат и confidence;
  - `trends.py` - окна 7/30/90 дней;
  - `scoring.py` - формула индекса 0-100.
- `backend/app/providers/` - интерфейсы источников:
  - `vacancies.py` - `VacancyDataProvider`, `DemoVacancyProvider`, guarded `HhApiProvider`;
  - `currency.py` - `CurrencyRateProvider`;
  - `payments.py` - `PaymentProvider` и встроенная реализация;
  - `ai.py` - `OptionalAiClassifier`;
  - `analytics.py` - будущий `AnalyticsSink` для ClickHouse.
- `backend/app/api/` - REST, auth, paywall, admin, payments и status;
- `backend/app/models.py` - SQLAlchemy-модель всех таблиц;
- `backend/app/schemas.py` - Pydantic-контракты;
- `backend/app/security.py` - cookies, JWT, CSRF, пароли и rate limit;
- `backend/app/seed.py` - детерминированные данные за 180 дней;
- `backend/app/data/catalog.py` - каталог 50 профессий;
- `backend/app/data/tech_stacks.py` - стек каждой профессии;
- `backend/app/services/scoring_service.py` - пересчёт рейтинга;
- `backend/app/worker.py` - Celery tasks/beat;
- `backend/sql/` - понятные SQL-модели метрик и трендов;
- `backend/alembic/` - миграции;
- `backend/tests/` - backend unit/integration/API/paywall/migration tests.

Frontend:

- `frontend/app/` - маршруты App Router;
- `frontend/components/` - переиспользуемые UI-компоненты;
- `frontend/lib/api.ts` - server-side вызов FastAPI с передачей cookie;
- `frontend/lib/types.ts` - TypeScript API types;
- `frontend/lib/contact.ts` - контакт `sqldevelopermoscow@yandex.com`;
- `frontend/app/globals.css` - темы, анимации и основная визуальная система;
- `frontend/tests/components.test.tsx` - component tests;
- `frontend/e2e/public-pages.spec.ts` - Playwright-сценарии;
- `frontend/tsconfig.check.json` - стабильная проверка исходников без конфликтов generated Next types.

Инфраструктура:

- `compose.yaml` - local-dev;
- `compose.production.yaml` - production overlay;
- `frontend/Dockerfile`, `backend/Dockerfile`;
- `infra/Caddyfile`.

## 5. Реализованная модель данных

Alembic-миграция создаёт:

- `professions`;
- `profession_aliases`;
- `profession_categories`;
- `seniority_levels`;
- `regions`;
- `vacancy_sources`;
- `source_queries`;
- `vacancies`;
- `vacancy_skills`;
- `vacancy_snapshots`;
- `salary_observations`;
- `currency_rate_snapshots`;
- `profession_metrics_daily`;
- `observed_publication_metrics_daily`;
- `profession_scores_daily`;
- `ingestion_runs`;
- `scoring_versions`;
- `users`;
- `subscriptions`;
- `entitlements`;
- `payment_events`;
- `audit_logs`;
- `notification_rules`.

Вакансия уникальна по `(source_id, external_id)`. Хранятся регион, валюта, gross/net, обе границы зарплаты, публикация, первое/последнее обнаружение, формат работы, remote, experience, профессия, seniority, confidence, источник и версия классификатора.

## 6. Каталог и подготовленные данные

Каталог содержит 50 профессий из исходного требования. У каждой есть:

- русское и английское название;
- slug;
- категория;
- уникальное описание;
- поисковые алиасы;
- типичный технологический стек;
- Premium-флаг.

Seed `20260717` воспроизводимо создаёт:

- 50 профессий;
- Junior/Middle/Senior;
- Россия, Москва, Санкт-Петербург и другие регионы;
- 180 дней метрик;
- разные тренды роста/падения/нейтральной динамики;
- вакансии с полной, частичной и отсутствующей зарплатой;
- разные валюты;
- редкие роли с недостаточной выборкой;
- free, premium и admin пользователей;
- активный scoring version.

Demo-аккаунты технически используют email:

- `free@example.com`;
- `premium@example.com`;
- `admin@example.com`.

Пароли берутся только из локального `.env`: `DEMO_FREE_PASSWORD`, `DEMO_PREMIUM_PASSWORD`, `DEMO_ADMIN_PASSWORD`. Не переносить реальные пароли в код или клиентский bundle.

## 7. Бизнес-логика

### Классификация

Порядок: Unicode/whitespace normalization -> aliases -> regex -> exclusions -> experience -> RU/EN seniority markers -> confidence.

Lead, principal и architect не превращаются в Senior автоматически. Optional AI вызывается только для неопределённых вакансий и не является обязательным.

### Зарплаты

Срез: профессия x seniority x region x period x gross/net basis.

Считаются vacancy count, salary count, coverage, median, average, P25, P75, медианы нижней/верхней границы, sample size и confidence. Midpoint создаётся только при двух границах. Gross/net не смешиваются. Минимум по умолчанию - 20 наблюдений.

### Тренды

Для 7/30/90 дней сравниваются средние текущего и предыдущего соседних окон. Порог:

- рост: больше +3%;
- нейтрально: от -3% до +3%;
- падение: меньше -3%.

Один день с предыдущим днём не сравнивается.

### Индекс 0-100

Версия `v1.0.0`:

- спрос 30%;
- зарплата 25%;
- рост спроса 20%;
- доступность для Junior 10%;
- remote share 10%;
- стабильность/качество данных 5%.

Demand проходит `log1p`, экстремумы ограничиваются, ключевые компоненты переводятся в percentile rank. В БД сохраняются version, total и breakdown. Низкий confidence не скрывается.

## 8. Публичные страницы и UX

Реализованы:

- `/` - главная;
- `/professions` - каталог с query/category фильтрами;
- `/professions/[slug]` - SSR-страница роли;
- `/categories/[slug]` - страницы категорий;
- `/top` - рейтинг;
- `/compare` - сравнение;
- `/dashboard` - Premium-дашборд;
- `/pricing` - тарифы;
- `/login`, `/register`, `/account`;
- `/alerts`;
- `/mentorship`;
- `/support`;
- `/methodology`;
- `/research` и `/research.json`;
- `/citation`, `/citation.json`, `/citation.bib`, `/citation.ris` и `/datapackage.json`;
- `/sources`;
- `/status`;
- `/admin`;
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`.
- `/manifest.webmanifest`, `/opengraph-image`, `/twitter-image` и `/icon.svg`.

Главная получила оригинальный редизайн:

- точный слоган «Сравните IT-профессии. Выберите направление по данным»;
- jobs-first поиск;
- недельный market pulse;
- карточки профессий в стиле карьерного каталога;
- светлую и тёмную тему;
- оригинальную code-native карьерную сцену.

Карьерная сцена написана HTML/CSS без чужих изображений и брендов. До взаимодействия персонаж сидит сутуло в худи и выглядит обеспокоенным. После hover/focus/tap он выпрямляется, меняет выражение, получает рубашку, галстук, пиджак, рабочую сумку, деньги и офер. Есть `prefers-reduced-motion`.

Визуальные референсы Apple, Netflix и hh.ru использовались только на уровне общих паттернов: последовательная анимация, кинематографичная иерархия и jobs-first поиск. Логотипы, тексты, изображения, шрифты и фирменные композиции не копировались.

Светлая тема реально осветляет шапку и hero. Мобильная версия проверена без горизонтального page overflow. Блок сравнения получил три пронумерованных picker-карточки и улучшенные select controls. Блок «Как устроена работа» сокращён до четырёх этапов.

## 9. Личное ведение и поддержка

Страница `/mentorship` описывает восьминедельную программу с нагрузкой около 20 часов в неделю. Четыре этапа:

1. направление и план;
2. навыки и практика;
3. проекты и позиционирование;
4. отклики и интервью.

`MentorshipForm` отправляет данные на отдельный `/api/v1/mentorship/requests`: заявка сохраняется в `mentorship_requests`, получает номер и ставит `deliver_mentorship_request`. Миграция `0007` добавляет nullable-колонку `proposed_budget_rub` для совместимости со старыми строками; UI и API требуют новое предложение от 1 000 до 1 000 000 ₽, сохраняют его и включают в письмо. Это только часть обращения, не browser-controlled сумма платежа. Формат, объём и итоговые условия рассматриваются индивидуально. Письмо имеет префикс `[TechRole Mentorship]`. Офер не гарантируется - это явно указано на странице.

Плавающая кнопка техподдержки ведёт на `/support`. Форма имеет собственный CSRF cookie, сохраняет обращение в `support_requests` и ставит `deliver_support_request`. Письмо имеет префикс `[TechRole Support]`. Обе формы используют Origin check, Redis rate limit и honeypot.

## 10. Доступ, auth, Premium и платежи

Состояния: anonymous, free, premium.

- каталог и landing page всех профессий публичны;
- около 70% ролей показывают базовую статистику;
- Premium-роли публично отдают только title/description/teaser;
- free history ограничена 30 днями;
- public ranking ограничен top-3;
- сравнение, полный рейтинг, dashboard, CSV и alerts требуют Premium.

Paywall реализован backend-ом до сериализации. Premium-поля не скрываются CSS: они вообще не попадают в free JSON, SSR HTML, metadata и JSON-LD. Это покрыто тестами.

Auth: Argon2 password hash, JWT HttpOnly/SameSite cookie, CSRF для mutation endpoints, rate limit login/register, RBAC admin/user.

`DemoPaymentProvider` проводит локальный sandbox без списания. Серверный product catalog определяет цену и 30-дневный доступ; `payment_orders` сохраняет idempotency key, provider id, сумму, test/live и принятую версию условий. HMAC demo webhook проверяет raw body, повторы дедуплицируются, отмена терминальна. Полный admin refund идемпотентен и отзывает только entitlement соответствующего заказа.

Владелец подтвердил статус самозанятого НПД. Основной кандидат — Robokassa с «Робочеками СМЗ», резервный — ЮKassa. `RobokassaPaymentProvider` создаёт подписанный redirect с числовым `InvId`, server-side Receipt и Success/Fail URL, проверяет подпись ResultURL Паролем №2, test/live режим и обязательный `OK<InvId>`. Live refund получает `OpKey`, отправляет HS256 JWT по Password3, а Celery сверяет pending-состояние каждые пять минут. `YooKassaPaymentProvider` сохраняет REST idempotency, возврат и авторизованную проверку webhook. Оба адаптера покрыты MockTransport/HTTP contract tests, но официальный test shop владельца ещё не вызван: нет выданных владельцем test credentials. `/admin` теперь показывает отдельную готовность test/live через admin-only `/admin/payment-readiness`; ответ содержит только признаки и ResultURL, без credentials. Реальный режим fail closed требует отдельного подтверждения, утверждённой оферты, фискализации и `PAYMENTS_STABLE_HTTPS_CONFIRMED=true` после проверки постоянного host. Полная памятка: `PAYMENTS.md`.

## 11. Административная панель

Backend endpoints и UI позволяют:

- редактировать профессию и Premium-флаг;
- просматривать/добавлять aliases;
- смотреть uncertain vacancies;
- вручную исправлять классификацию;
- запускать пересчёт и смотреть task state;
- смотреть ingestion runs;
- создавать scoring version с новыми весами;
- блокировать пользователя;
- выдавать Premium;
- просматривать audit logs.

Admin mutation endpoints защищены backend RBAC + CSRF. Действия записываются в `audit_logs`.

## 12. Основные API

Все API-маршруты имеют prefix `/api/v1`.

Профессии:

- `GET /open-data/publications`;
- `GET /open-data/publication-metrics-daily`;
- `GET /professions`;
- `GET /categories`;
- `GET /professions/{slug}`;
- `GET /ranking`;
- `GET /compare`;
- `GET /dashboard`.

Auth:

- `POST /auth/register`;
- `POST /auth/login`;
- `POST /auth/logout`;
- `GET /auth/me`.

Premium:

- `GET /export/professions/{slug}.csv`;
- `GET/POST /alerts`;
- `DELETE /alerts/{id}`.

Service:

- `GET /status`;
- `GET /sources`;
- `GET /support/csrf`;
- `POST /support/requests`;
- `GET /mentorship/csrf`;
- `POST /mentorship/requests`;
- `GET /health/ready`;
- `GET /health/live` без `/api/v1`.

Payments:

- `GET /payments/products`;
- `POST /payments` с CSRF и `Idempotency-Key`;
- `GET /payments/{order_id}` только владельцу/admin;
- `POST /payments/{order_id}/demo/complete` только в sandbox;
- `POST /payments/{order_id}/refund` только admin;
- `POST /payments/webhooks/demo`;
- `POST /payments/webhooks/yookassa`;
- `POST /payments/webhooks/robokassa`.
- `GET /admin/payment-readiness` только admin, без секретных значений.

Admin: endpoints находятся под `/api/v1/admin/*`; точный контракт смотреть в Swagger.

## 13. SEO и LLM discoverability

Реализованы:

- SSR публичных страниц;
- metadata и canonical URL;
- Open Graph;
- sitemap и robots;
- хлебные крошки;
- JSON-LD `Occupation`, `Dataset`, `WebSite`, `Organization`, `BreadcrumbList`;
- уникальные описания профессий;
- категории и внутренние ссылки;
- `/open-data-daily` с Dataset и Croissant 1.1 JSON-LD, полным словарём 27 JSON-полей и проверяемыми агрегатами; `/open-data-daily.schema.json` со строгим Draft 2020-12 контрактом; `/open-data-daily.croissant.json` и `/open-data-daily.csv-metadata.json` с 30 фактическими CSV-колонками, типами, ключом и provenance; `/catalog.jsonld` с W3C DCAT 3 Catalog/Dataset/distributions/DataService; `/llms.txt`, `/.well-known/llms.txt`, `/llms-full.txt`, `/ai-index.json`, `/open-data.json`, `/open-data.csv`, `/open-data-daily.json`, `/open-data-daily.csv` и RSS с машинным описанием, открытыми salary slices и правилами интерпретации;
- `/citation` с CSL-JSON/BibTeX/RIS/Data Package и `/research` с динамическим обзором официального 180-дневного слоя;
- `/data-status` и `/data-status.json`: подготовленная gross-витрина и официальный исторический слой разделены в SSR, JSON и на каждой profession page; `current_market_claim=false` для обоих;
- `data-status` дополнительно показывает диапазон, число срезов, публикаций и версию инкрементальной SQL-материализации официального слоя;
- `/insights`, двенадцать `TechArticle` страниц и `/insights.json`: весь утверждённый editorial backlog покрыт уникальными методическими разборами, связанными с RSS, sitemap, Data Package, AI/LLM indexes; каждая статья публикует Highwire meta и собственные `/cite/csl-json`, `/cite/bibtex`, `/cite/ris`;
- оригинальные Open Graph/Twitter preview, web manifest и SVG favicon;

Это улучшает машинную читаемость, но не гарантирует позицию в поиске или цитирование LLM. Premium-значения не добавляются в публичные машинные представления.

## 14. Источники и юридическое ограничение

`DemoVacancyProvider` включён по умолчанию. `HhApiProvider` подготовлен, но обязан оставаться выключенным, пока одновременно не заданы:

- `HH_ENABLED=true`;
- `HH_COMMERCIAL_USE_CONFIRMED=true`;
- `HH_CONTACT_EMAIL`;
- `HH_APP_NAME`;
- при необходимости официальный access token.

HhApiProvider использует только официальный API, одну страницу до 100 записей за вызов, корректный HH-User-Agent и не обходит rate limit, CAPTCHA или глубину выдачи. HTML scraping, прокси-ротация и чужие логотипы запрещены.

Флаг не является юридическим разрешением. Коммерческое использование данных API может требовать письменного разрешения правообладателя. Нельзя утверждать, что такое разрешение получено, пока у владельца проекта нет подтверждающего документа.

## 15. Ollama и AI

На Windows доступен Ollama `0.32.1` по `127.0.0.1:11434`. Ранее установленная `mistral:7b` не прошла constrained-проверку. 2026-07-18 дополнительно установлена `qwen3.6:27b` Q4_K_M, 17 ГБ, 27.8B параметров, Apache-2.0.

Холодная 4K-проверка `qwen3.6:27b` завершилась правильным структурированным ответом за 79 секунд: load 55.66 с, prompt 3.00 токена/с, output 1.46 токена/с. `ollama ps` показывал 70% CPU / 30% GPU; использовалось около 30.92 ГБ RAM и 7666 MiB VRAM. После замера выполнен `ollama stop qwen3.6:27b`, RAM/VRAM освобождены, модель осталась установленной.

Локальный `.env` указывает `OLLAMA_MODEL=qwen3.6:27b` и включает AI-assist для nightly-pipeline. Docker-контейнер успешно классифицировал тестовый title как `nlp-engineer`. Это не интерактивный runtime: основной классификатор остаётся объяснимым rule-based, AI вызывается максимум для 3 неопределённых записей за run, проверяет slug/seniority, получает confidence cap 0.79 и выгружается после обработки.

2026-07-21 добавлен воспроизводимый benchmark из 20 синтетических русскоязычных кейсов: близкие data/AI/infra/security/QA-роли, явный и отсутствующий seniority, три обязательных abstention на support/project-manager/бухгалтере 1С. Провайдер теперь передаёт Ollama строгий JSON Schema с enum 50 разрешённых slug и независимо валидирует ответ Pydantic с `extra=forbid`. `qwen3.6:27b` прошла schema/slug/seniority/exact `20/20` и abstention `3/3` за 276,4 с; первый холодный кейс — 40,2 с, остальные 10–14 с. Отчёт сохранён в игнорируемом `outputs/ai-classifier-qwen3.6-27b-20260721.json`, после завершения `ollama ps` пуст. Benchmark остаётся synthetic guardrail, а не разрешением включать AI в основной путь или повышать cap/лимит.

## 16. Docker и важное исправление массового 404

2026-07-18 все страницы `/professions/[slug]` начали возвращать стандартный Next.js 404, хотя backend `GET /api/v1/professions/{slug}` отвечал 200.

Причина: dev-сервер и локальные production-проверки писали route manifests в пересекающийся bind-mounted `.next`. После build dev manifest перестал видеть динамический route.

Исправление:

- в `compose.yaml` frontend получил `NEXT_DIST_DIR=.next-dev`;
- production продолжает использовать стандартный `.next`;
- `frontend/tsconfig.check.json` проверяет исходники независимо от generated directories;
- `tsconfig.json` исключает `.next-dev` и `.next-*`;
- frontend-контейнер пересоздан.

После исправления автоматически проверены все 50 slug: `CHECKED=50 FAILED=0`, каждый вернул HTTP 200 и SSR-контейнер `profession-page`.

Не убирать разделение `.next-dev`/`.next`. Это регрессионно важное решение №23 в `DECISIONS.md`.

## 17. Проверки на момент handoff

Backend внутри контейнера:

- Ruff: passed;
- mypy: passed, 54 source files;
- pytest: `123 passed`.

Frontend:

- ESLint: passed;
- source TypeScript: passed;
- backend Ruff + mypy + pytest: `123 passed`;
- Vitest: `48 passed`;
- Next.js production build: passed, 63 generated page artifacts, включая legal/payment routes, три salary-benchmark routes и 12 SSG insights; динамические `/open-data-daily`, `/open-data-daily.csv-metadata.json`, `/open-data-daily.schema.json`, `/open-data-daily.croissant.json` и `/catalog.jsonld` присутствуют в route manifest;
- отдельные production-check Docker images frontend/backend: built and smoke-tested, HTTP 200;
- Playwright Chromium profile: `30 passed`. Сценарии включают полный demo payment flow с регистрацией, явным принятием условий, sandbox checkout и выдачей Premium, 50 profession links, 150/150 грейдовых зарплатных карточек и salary JSON/CSV, статус аудита зарплатных источников, 12 Article routes, Dataset landing/count/JSON-LD, строгий 27-field JSON Schema, Croissant 1.1 и CSVW с 30 фактическими CSV-полями, DCAT Catalog/Dataset/DataService с двумя distributions, conditional `304`, заполненность AI/open-data/citation/research endpoints, светлую/тёмную палитру, формы/селекты, accessibility/reduced-motion и lab performance budgets;
- независимый `csvw 4.1.0` contract применяется к 742 строкам опубликованной metadata: 30 колонок и составной primary key; daily CSV публикуется как UTF-8 без BOM для совместимости CSVW, отдельный aggregate CSV не менялся;
- DCAT JSON-LD дополнительно разобран независимым `rdflib 7.1.4`: 62 RDF-триплета, по одному Catalog, Dataset и DataService, две Distribution; endpoint локально отвечает `200` и strong SHA-256 ETag;
- официальный `mlcroissant 1.1.0`: validate завершился `Done`, loader скачал объявленный CSV и типизированно прочитал первые три записи всех 30 полей; отсутствие checksum для `isLiveDataset=true` распознано штатно;
- hosted CI после запуска Compose устанавливает закреплённый `mlcroissant==1.1.0`, повторяет validate и загрузку первых трёх записей до Playwright;
- sitemap-driven public audit: `86 checked, 0 failed` через текущий внешний HTTPS preview; для каждого canonical HTML URL проверены status/content-type, уникальные title/description, canonical, один h1, `lang=ru`, отсутствие `noindex` и валидность всего JSON-LD;
- после одного hosted audit failure на `/categories/specialized` category metadata переведены с повторного API-вызова на локальный стабильный reference с SSR fallback; два последовательных локальных crawl снова дали `86 checked, 0 failed`;
- те же 11 accessibility/reduced-motion сценариев отдельно прошли на immutable production standalone через постоянный public proxy;
- production lab после исправления assets: в повторных проходах максимум TTFB/FCP/LCP составил `51/140/444 ms`, CLS везде `0`, theme event duration `48-64 ms`; это локальный guardrail, не field p75;
- все публичные маршруты скомпилированы;
- smoke crawl: 18 основных маршрутов и 50 страниц профессий, ошибок `0`;
- browser smoke: форма поддержки зарегистрировала заявку, Celery обработал её, тестовая запись удалена;
- чистый browser reload `/support`: heading/form по одному экземпляру, console errors `0`;
- `docker compose up --build -d`: миграция/seed завершились с code 0, восемь постоянных сервисов, включая Dagster webserver/daemon, healthy;
- Compose config: passed;
- все 50 profession detail SSR routes: passed.
- внешний production-preview smoke после CSVW/DCAT: homepage/canonical/security headers, browser assets, 50 AI-сущностей, 50 Dataset, 151 aggregate CSV-строка, 742 daily JSON record, 743 daily CSV-строки, 27-field Draft 2020-12 schema и соответствие каждой строки, CSVW и Croissant 1.1 с 30 фактическими CSV-полями, DCAT с двумя distributions, SHA-256 ETag/Last-Modified и conditional `304`, канонический Dataset landing, 3 provenance-слоя, 12 editorial insights, все 12 Article pages и 12 per-article CSL records, 50 LLM-описаний, dataset citation CSL, research aggregate, 85 sitemap URL, Open Graph PNG и backend readiness - passed. Изолированная симуляция недоступного backend подтвердила `503`, `Retry-After: 60` и `Cache-Control: no-store` для daily exports;
- постоянный loopback `public-proxy` на 3199 пережил force-recreate standalone upstream на 3100; позднее анонимный localhost.run ротировал hostname внутри живого PID, поэтому добавлен refresh последнего URL из логов с историей previous URLs;
- после одобрения владельца запущен Tailscale Funnel `https://win-702hpohbtiv.tail044b19.ts.net` на `127.0.0.1:3199`; актуальный immutable `.next-public-tsnet-v022` собран с этим canonical. Внешний smoke подтвердил admin page, новый credential-free readiness bundle, `401` для анонимного payment-readiness API, стабильный description `/categories/specialized`, поле `/mentorship`, Alembic head `0007`, один комплект Junior/Middle/Senior, 37 прямых / 13 смежных / 0 category-only профессий, 50 профессий и 432 строки salary CSV, 742 daily slices, три provenance-слоя, 86 sitemap URL и условные ответы `304`; все постоянные сервисы healthy. Платежи на preview используют только `demo/test`, terms остаются draft, а `PAYMENTS_STABLE_HTTPS_CONFIRMED=false`. Funnel остаётся beta и host-dependent preview, а не отказоустойчивым production;
- canonical Dataset JSON-LD дополнительно сверён с актуальной документацией Google Dataset Search: самоцитирование удалено из предназначенного для связанных научных работ `Dataset.citation`, а identifier/creator/publisher/canonical URL и отдельные citation formats сохранены; целевой Playwright-сценарий, ESLint и TypeScript прошли;
- `CITATION.cff` исправлен по CFF 1.2 (`preferred-citation.type=data` при верхнеуровневом GitHub `type=dataset`) и независимо прошёл `cffconvert 2.0.0 --validate`; отдельный CI job повторяет эту проверку на hosted runner;
- Gitleaks повторно просканировал staged payment diff и всю пятикоммитную очищенную `public-main`: `no leaks found`. Старый синтетический production-settings fixture исключён только точным fingerprint в `.gitleaksignore`; целые файлы, пути и commits не исключаются;
- Compose default/public/production/observability configs и GitHub Actions/Dependabot YAML - passed;
- rendered production security contract на синтетических credentials - passed: один HTTPS origin в backend/frontend build/runtime/Caddy, 7 backend-сервисов с `APP_ENV=production`/`DEMO_MODE=false`, без bind-mount `/app`, только Caddy публикует 80/443; отдельный PostgreSQL bootstrap smoke создал 50 reference professions при `users=metrics=vacancies=enabled_demo_sources=0` и затем удалил временную БД/роль;
- Prometheus `/metrics`: standard text format, privacy/cardinality tests passed; временный Gunicorn с 2 workers агрегировал 30 запросов из 4 multiprocess-файлов без пользовательских `@`;
- Redis catalog/detail cache: miss→hit, SHA-256 key без slug/query, TTL 119 секунд; при pause Redis detail API ответил 200 за 621 мс и Redis вернулся healthy;
- миграция `0004` применена; официальный CBR snapshot на 2026-07-20 сохранён для USD/EUR/KZT с effective date 2026-07-18;
- Dagster `verify_public_salary_benchmarks` включён локально; последний выборочный запуск `37c084d7-e020-409c-9f1e-625dd6aa73ea` подтвердил 10 из 10 публичных metadata SEO-медиан, включая два смежных среза. Аудит делает до трёх ограниченных попыток, отличает сетевую недоступность от изменения числа, запрещает автоматическую перезапись и сохраняет результат в `audit_logs` для краткого summary на `/status`;
- миграция `0005` применена; PostgreSQL full refresh создал 691 observed-publication slice для 1 052 классифицированных публикаций, повторный overlap refresh обработал только 7 дней, stale/invalid/leaked slices равны 0;
- миграция `0006` применена; `payment_orders` и `payment_refunds` находятся на Alembic head, sandbox API/webhook/refund/replay/tampering, YooKassa и Robokassa contract tests прошли; Robokassa ResultURL и live refund reconciliation покрыты отдельно;
- миграция `0007` применена; существующие обращения сохранены, а новые заявки личного ведения требуют и передают отдельное предложение стоимости без создания payment order;
- rolling research/provenance window выровнено по 180 полным UTC-календарным дням: schema `1.3` публикует полуоткрытые timestamp-границы и третий зарплатный слой, а live catalog и provenance оба дают 1 278 классифицированных публикаций за 2026-01-23..2026-07-21;
- `rules-v2` повторно классифицировал только записи без решения или с rule-based решением: 1 050 -> 1 130 rule-managed строк, `cleared=0`; две AI-классификации сохранены, представлены 36 из 50 профессий, достаточная зарплатная выборка есть у 7;
- 2026-07-21 новый PostgreSQL custom backup (3 864 514 bytes) создан с SHA-256 manifest и действительно восстановлен `infra/windows/test-postgres-restore.ps1` в изолированную БД: revision `0005`, 26 public tables, 50 professions, 108 000 prepared metric rows, 691 observed slices, 5 535 vacancies и 3 users. После проверки временная БД и container archive удалены; основная БД не останавливалась.

В локальном in-app browser проверены:

- новая главная;
- светлая/тёмная тема;
- карьерная сцена и её settled state;
- `/compare` и три селекта;
- `/mentorship` и четыре этапа;
- мобильная ширина: `scrollWidth === clientWidth`.

Playwright запускается из отдельного профиля на официальном Chromium-образе. Команда `docker compose --profile e2e run --rm e2e` прошла все 29 сценариев. Для доступа к HMR внутри Compose в `allowedDevOrigins` разрешён только внутренний hostname `frontend`; production CSP и публичные origins не расширены. `npm run audit:public` читает sitemap запущенного экземпляра и отдельно проверяет все 85 canonical HTML URL; шаг включён в compose-e2e job GitHub Actions. Четыре performance-сценария сохраняют TTFB/FCP/LCP/CLS/event duration как attachments и используют lab budgets с запасом.

## 18. Команды

Полный local-dev:

```powershell
cd "<workspace>\full-stack-data-engineer-ux-mvp"
docker compose up --build -d
docker compose ps
```

Пересоздать только frontend после изменения Compose environment:

```powershell
docker compose up -d --force-recreate frontend
```

Миграции и seed:

```powershell
docker compose run --rm migrate alembic upgrade head
docker compose run --rm seed python -m app.seed --force
```

Backend checks:

```powershell
docker compose exec -T backend sh -lc "ruff check . && mypy app && pytest"
```

Frontend checks:

```powershell
docker compose exec -T frontend sh -lc "npm run lint && npm run typecheck && npm test"
docker compose exec -T frontend npm run build
```

Compose validation:

```powershell
docker compose config --quiet
```

Production:

```powershell
docker compose -f compose.yaml -f compose.production.yaml --profile production up --build -d
```

Worker/scheduler:

```powershell
docker compose up worker scheduler
```

## 19. Типовые проблемы среды

### PowerShell profile

При каждом escalated Docker-вызове Windows может печатать ошибку загрузки `Documents\WindowsPowerShell\profile.ps1`, потому что script execution отключён. Если сама Docker-команда имеет exit code 0, это предупреждение не влияет на проект.

### Docker Hub EOF/TLS

Во время первой установки Docker были ошибки получения token/blob с Docker Hub (`EOF`, TLS handshake). `curl` к registry сначала не проходил, затем вернул ожидаемый 401 и `docker pull` заработал. Это была сеть/TLS Docker Desktop, не код проекта.

2026-07-19 повторная сборка production Docker image остановилась на `HEAD node:22-alpine` с тем же внешним `registry-1.docker.io: EOF`. При этом локальный `next build`, TypeScript, lint, Vitest, backend suite и E2E прошли; Compose production config валиден. Для полного image rebuild нужно повторить команду после восстановления Docker Hub connectivity.

2026-07-20 Docker Hub снова оборвал HEAD базового Python image и две загрузки `prom/prometheus:v3.5.0`. `prometheus-client` установлен в текущий dev-контейнер, проверен и сохранён локальным fallback image `techrole-index-backend:latest`; обычный воспроизводимый build описан `pyproject.toml` и должен заменить fallback после восстановления registry. Prometheus Compose/YAML/alerts валидны, но сам Prometheus-контейнер из-за внешнего EOF ещё не запущен.

2026-07-21 после production hardening Docker Hub снова вернул EOF на metadata/token для `node:22-alpine` и `caddy:2-alpine`; повторный `docker pull node:22-alpine` также завершился на registry manifest HEAD. Dockerfile build args и rendered Compose проверены, обычные Next production builds прошли, но новый production image tag нужно повторно собрать после восстановления registry.

### Generated Next types

Next build может автоматически дописывать custom dist type paths в `tsconfig.json` и import в `next-env.d.ts`. Для проверок используется `tsconfig.check.json`. После экспериментальных custom-dist builds нужно вернуть `next-env.d.ts` к двум reference-строкам, а `tsconfig.json` - к `.next/types/**/*.ts`. Обычный production build теперь можно запускать отдельно от `.next-dev`.

### Next standalone browser assets

Сам каталог `<dist>/standalone` не включает `<dist>/static`: без отдельной подготовки HTML и JSON отвечают 200, но `/_next/static/*` возвращает 404, CSS отсутствует, React не гидратируется и CLS растёт. После каждой custom-dist сборки обязательно запускайте `NEXT_DIST_DIR=<тот же каталог> npm run prepare:standalone` до переключения `PUBLIC_BUILD_DIR`. Скрипт копирует static и optional `public`, а внешний `test-public-preview.ps1` запрашивает все CSS/JS главной страницы.

### Playwright

Добавлен отдельный профиль `e2e` на официальном образе `mcr.microsoft.com/playwright:v1.61.1-noble`. Он не запускается в обычном окружении и вызывается командой `docker compose --profile e2e run --rm e2e`. Chromium и зависимости изолированы от Alpine frontend runtime.

## 20. Что ещё не готово

- официальный open-data API «Работа России» подключён: реальные публикации и salary midpoint видны отдельным публичным слоем и инкрементально материализованы, но неизвестный gross/net намеренно не преобразуется в gross-витрину;
- юридическое разрешение на коммерческое использование данных hh.ru не подтверждено;
- официальный CBR currency provider подключён отдельным контуром и локально включён: migration `0004`, snapshots USD/EUR/KZT, requested/effective date и Dagster op. Эти rates ещё не применяются к несовместимому gross/net слою автоматически;
- владелец подтвердил НПД; Robokassa выбрана основным payment-кандидатом из-за автоматических «Робочеков СМЗ», ЮKassa оставлена резервом. Demo sandbox и оба адаптера готовы, но test/live credentials, KYC, договор, активацию чеков, юридические реквизиты и постоянный HTTPS-host может предоставить только владелец;
- Yandex SMTP и IMAP работают; пять писем Support/Mentorship/Nightly подтверждены во входящих, две сохранённые заявки доставлены. Пароль остаётся только в локальном `.env`;
- Tailscale работает на ПК и iPhone. Firewall ограничен tailnet, но TCP 3389 ещё не слушает: владелец должен один раз повторно запустить исправленный `infra/windows/enable-private-remote-access.ps1` от администратора и получить `ListenerReady=True`;
- production Compose теперь fail closed проверяет secrets/URLs/DB credentials, удаляет source mounts/лишние ports и безопасно bootstrap-ит пустую БД без demo data; сам deployment, постоянный домен, TLS и внешняя observability ещё не настроены;
- перед публичным Git push Gitleaks 8.30.1 проверил все 20 commits: точечно разрешён только synthetic production-settings fixture, повторный scan сообщает `no leaks found`; SHA-pinned workflow `secret-scan.yml` готов повторять проверку;
- auth rate limit перенесён в Redis, HMAC-хеширует IP и fail-closed в production;
- Prometheus-compatible HTTP metrics, multiprocess Gunicorn storage, loopback-only Prometheus profile и alerts down/5xx/p95/cache-errors добавлены; внешний Alertmanager/Sentry/OpenTelemetry collector ещё не подключён;
- ClickHouse только предусмотрен интерфейсом;
- `qwen3.6:27b` прошла structured-output, live Docker-provider и воспроизводимый 20-case domain benchmark; перед расширением AI-assist всё ещё нужна размеченная holdout-выборка будущих реальных uncertain records без персональных данных;
- публичный GitHub remote настроен через отдельную очищенную ветку `public-main`, которая отправляется в удалённый `main`; внутреннюю историю нельзя merge/rebase в публичную;
- GitHub Actions, secret scan, Dependabot и ежедневный внешний monitor опубликованы и выполняются на hosted runner;
- стабильный для этой машины production-like preview доступен через Tailscale Funnel `https://win-702hpohbtiv.tail044b19.ts.net` к постоянному local proxy; актуальная проверенная конфигурация хранится в `%LOCALAPPDATA%\TechRoleIndex\public-funnel-status.json`. Это beta/host-dependent адрес, не замена отдельному production-host и собственному домену;
- `infra/windows/start-public-funnel.ps1` повторно проходит идемпотентно и доверяет структурированному `tailscale funnel status --json`, а не одному exit code команды настройки. Cloudflare Quick Tunnel сохранён только как аварийный временный fallback и тоже направляется на proxy 3199.

## 21. Рекомендуемый дальнейший план

Приоритет P0:

1. Настроить шифрованную off-host копию; удалённый Git origin, локальный PostgreSQL backup и автоматический полный restore-test уже созданы.
2. Зафиксировать допустимые production-условия использования API «Работа России» и отдельно документированное право для любого будущего коммерческого источника.
3. Publication-date materialization и quality gate выполнены отдельным Dagster op; дальше нужна только юридически и методически подтверждённая gross/net-нормализация перед любым переносом зарплат в prepared слой. CBR snapshots работают отдельно.
4. Выполнено: UI, profession SSR, `data-status.json` и CSV разделяют `prepared_baseline` и `observed_historical`, не подменяя статус свежей датой.
5. Production secret/Compose contract подготовлен и проверен на синтетических credentials; дальше на отдельном host создать пустую БД, заполнить реальный `.env`, выбрать постоянный домен и проверить Caddy TLS. Local demo volume намеренно не подходит.

Приоритет P1:

1. Поддерживать очищенную `public-main`, проверять обязательные GitHub Actions после каждого push и не публиковать внутреннюю историю/локальные секреты.
2. Получить от владельца Robokassa test shop, MerchantLogin и тестовые Пароли №1/№2 через локальный secret store; подтвердить конечную цену и что текущий продукт остаётся разовой 30-дневной услугой. Затем вызвать официальный sandbox и проверить ResultURL через постоянный HTTPS ingress. Live не включать без отдельного явного подтверждения.
3. Определить срок хранения обращений и процедуру ротации SMTP app password; раздельная доставка Support/Mentorship/Nightly уже проверена.
4. Prometheus-compatible метрики и локальные alert rules выполнены; дальше выбрать внешний Alertmanager-канал и при необходимости Sentry/OpenTelemetry collector.
5. После стабильного домена настроить Search Console/Webmaster, IndexNow key и содержательные внешние публикации; временные tunnel URL не регистрировать.

Приоритет P2:

1. Redis cache каталога/detail, изолированные incremental SQL transforms, публичные daily JSON/CSV/Schema exports и HTTP validators выполнены; следующий шаг - измерить query/cache нагрузку и долю `304` после стабильного трафика и только затем усложнять storage.
2. Рассмотреть ClickHouse только после фактической нагрузки.
3. Провести benchmark локальных моделей; AI оставлять только вспомогательным механизмом uncertain records.
4. Accessibility, lab performance budgets и полный SEO crawl автоматизированы и проходят на local/public preview; после стабильного production domain остаются полевые p75 Core Web Vitals/RUM и повторный внешний crawl на каноническом host.

## 22. Продуктовые предпочтения владельца

- интерфейс должен быть живым, а не выглядеть как типичный «нейронный» шаблон;
- стиль - современный аналитический и карьерный сервис, с анимациями, но понятный новичкам;
- светлая тема должна быть заметно светлой;
- на главной нужен точный продуктовый смысл, а не абстрактный рекламный слоган;
- навязчивая маркировка «демо» не должна резать глаз, но нельзя вводить пользователя в заблуждение о происхождении данных;
- выбор профессий должен выглядеть как полноценный продуктовый инструмент;
- контакт поддержки и личного ведения: `sqldevelopermoscow@yandex.com`;
- длинные тире в пользовательском тексте ранее заменялись на короткие;
- шапка должна оставаться компактной, «Личное ведение» - в одну строку;
- Premium нельзя реализовывать только визуальным скрытием.

## 23. Инструкция следующему чату

1. Прочитать `AGENTS.md`, `HANDOFF.md`, `DECISIONS.md`.
2. Проверить `docker compose ps` и `docker compose config --quiet`.
3. Не удалять и не сбрасывать пользовательские файлы; Git существует, поэтому сначала проверить `git status` и baseline history.
4. Не включать HH и не вызывать его API без всех guard-переменных и подтверждённого законного основания.
5. Для изменений доступа обязательно запускать paywall tests и проверять отсутствие Premium-полей в free JSON/HTML.
6. Публичные profession pages должны оставаться SSR и индексируемыми.
7. Не возвращать frontend dev cache с `.next-dev` на общий `.next`.
8. После изменений выполнить обязательные команды из `AGENTS.md`, production build и пропорциональный browser smoke-test.
9. Любое новое важное предположение добавить в `DECISIONS.md`.
## Latest infrastructure handoff (2026-07-22)

The permanent domain `techrole.ru` is registered in the owner's Selectel account and DNS records are prepared: apex A `94.102.88.123`, `www` CNAME `techrole.ru.`. Production `.env` on the VDS uses `https://techrole.ru` for all public/origin URL settings. Caddy redirects the legacy `94-102-88-123.sslip.io` address to the new apex. The registry may still report the zone as not delegated while nameserver verification propagates; check `nslookup -type=NS techrole.ru` and only then perform the final HTTPS smoke test. Real Robokassa charges remain disabled.

## Latest product handoff (2026-07-23)

The public UI now has a compact profession-page outline, dynamic data-confidence badges, a non-duplicating quick summary, and clearer fallback/retry links. Catalog and home search accept Russian/English names, show browser suggestions, and support a category filter in the same request. API reads abort after eight seconds so a temporary backend issue renders the existing fallback instead of hanging SSR. Premium remains a single 30-day product and its server-side catalog price is now 290 RUB; the pricing page displays that planned price even while payment acquisition is disabled. Live charges remain disabled until the owner completes provider, legal, fiscal, DNS/TLS and hosting gates.
