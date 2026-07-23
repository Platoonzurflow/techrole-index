# Privacy-first аналитика TechRole Index

Встроенный admin-дашборд находится на `/admin/analytics` и доступен только роли `admin`. Он показывает 7, 30 или 90 дней: уникальные согласившиеся браузеры, просмотры публичных страниц, внутренние клики, копирования цитат, AI-referrals и обращения заявленных search/AI crawlers.

## Что считается

- посетитель получает случайный first-party ID только после явного согласия; в БД хранится HMAC, исходный ID не хранится;
- администратор в авторизованной сессии, Playwright/headless, Lighthouse, curl, Python и другие automation User-Agent исключаются;
- приватные пути кабинета, admin, auth, alerts, payments и API не записываются;
- IP, полный User-Agent, email, содержимое форм, поисковые query strings и платёжные данные не записываются;
- referrer сокращается до валидного hostname, internal referrer отбрасывается;
- срок хранения задаётся `ANALYTICS_RETENTION_DAYS`, ежедневная задача удаляет старые строки.

«Уникальный посетитель» — уникальный согласившийся браузер, а не гарантированно один физический человек: разные устройства считаются отдельно, очистка storage создаёт новый ID, отказавшиеся не видны. Владелец не считается при входе как admin и не должен принимать consent в анонимной сессии во время ручных smoke-тестов.

## Цитаты и AI

Внешняя нейросеть не сообщает сайту факт цитирования. Дашборд честно показывает только измеримые сигналы:

- нажатие «Скопировать цитату»;
- переход с известных AI-доменов;
- HTTP GET с официально заявленным crawler User-Agent.

User-Agent можно подделать. Googlebot нельзя надёжно разделить на обычный поиск и AI-функции. Поэтому эти числа — наблюдения запросов, не доказательство индексации, использования в обучении или показа конкретной цитаты.

## Production enablement

Сгенерировать два разных случайных секрета длиной не менее 32 символов и сохранить только в server `.env`/secret store:

```dotenv
ANALYTICS_ENABLED=true
ANALYTICS_INGEST_KEY=<random internal ingestion key>
ANALYTICS_HASH_KEY=<different random HMAC key>
ANALYTICS_RETENTION_DAYS=400
```

Затем применить Alembic migration `0009`, пересобрать backend/frontend/worker/scheduler и проверить:

1. анонимный `/api/v1/admin/analytics` отвечает `401`, обычный пользователь — `403`;
2. отказ в consent не создаёт visitor ID и события;
3. согласие создаёт pageview публичного URL, admin page показывает одну запись;
4. admin/automation визиты не меняют human totals;
5. тестовый `OAI-SearchBot` запрос виден только как crawler request, не human;
6. в JSON/БД нет raw visitor ID, IP, email или provider credentials.

Dashboard не требует Power BI и работает на той же production-инфраструктуре. Экспорт в BI можно добавить позднее через отдельную агрегированную admin-only выгрузку; прямой доступ BI к production-таблице и передача сырых псевдонимов не допускаются.
