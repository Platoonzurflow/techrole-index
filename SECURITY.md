# Безопасность TechRole Index

## Поддерживаемая версия

Исправления безопасности выпускаются для текущего состояния ветки `main` и последнего опубликованного release. Старые preview-сборки и локальные копии не получают отдельные backport-исправления.

## Реализованные защитные меры

- Argon2 через `pwdlib`; открытые пароли не сохраняются.
- JWT в HttpOnly/Secure-in-production/SameSite=Lax cookie с ограниченным TTL.
- Double-submit CSRF для авторизованных mutation endpoints.
- Redis rate limit login/register: 10 попыток на HMAC-хеш IP за 10 минут, с fail-closed поведением в production.
- Backend RBAC: user/admin и отдельная серверная entitlement-проверка.
- Premium-поля исключаются до JSON serialization; закрытые страницы получают `noindex`.
- Формы поддержки и личного ведения имеют отдельные CSRF cookie/endpoints, Origin-проверку, honeypot и rate limit по HMAC-хешам IP/email.
- SMTP-секреты читаются только из server-side environment; текст заявки, email и IP не пишутся в access logs.
- Pydantic validation, parameterized SQLAlchemy, HMAC webhook и уникальная идемпотентность события.
- Admin actions пишутся в `audit_logs`; ручная классификация получает отдельную version.
- CSP, frame deny, MIME sniffing deny, referrer/permissions policies применяются на Next, API и Caddy.
- `X-Request-ID` и HTTP metrics используют только method, route template, status/duration; query, IP, email, cookie и body не становятся log fields или metric labels.
- Redis cache разделён на `public`/`premium` tier и получает только SHA-256 key; отказ cache не расширяет entitlement.
- Preview proxy слушает только `127.0.0.1:3199`, удаляет client-IP forwarding headers и не публикует БД, Redis, backend, Dagster или RDP.
- Production settings fail closed запрещают demo mode, HTTP/localhost origins, слабые secrets/default DB password, source bind-mounts и лишние опубликованные порты.
- Raw provider payload не хранится; `TrudvsemOpenDataProvider` сохраняет только allowlist профессиональных полей без контактов и адресов.
- Gitleaks проверяет всю Git-историю локально и в отдельном SHA-pinned GitHub Actions workflow.

## Как сообщить об уязвимости

Не создавайте публичный issue, если проблема может раскрыть секрет, персональные данные, Premium-данные или позволить обойти аутентификацию, paywall, CSRF/CORS, rate limit либо изоляцию внутренних сервисов.

Предпочтительный канал после публикации репозитория — GitHub Private Vulnerability Reporting на вкладке Security. Если он недоступен, отправьте письмо на `sqldevelopermoscow@yandex.com` с темой `[TechRole Security]`.

В сообщении достаточно указать:

- затронутый публичный URL, commit или release;
- ожидаемое и фактическое поведение;
- минимальные шаги воспроизведения и влияние;
- безопасный proof of concept без чужих данных;
- способ связаться с вами для уточнений.

Не отправляйте действующие токены, пароли, cookies, полные production-логи, дампы БД или персональные данные. Если секрет уже попал в сообщение, прямо отметьте это, чтобы его можно было немедленно отозвать.

Мы постараемся подтвердить получение в течение семи календарных дней, затем сообщить результат первичной оценки и согласовать раскрытие после исправления. Срок исправления зависит от риска и воспроизводимости; обещание фиксированного SLA этот документ не создаёт.

## Безопасное исследование

Разрешена добросовестная проверка собственного аккаунта и публичных read-only маршрутов при обычной частоте запросов. Не разрешены DoS/нагрузочные атаки на публичный preview, social engineering, попытки получить чужие заявки или аккаунты, сканирование домашней сети владельца и изменение/удаление данных.

Для ошибок качества открытых агрегатов без security-влияния используйте шаблон Data quality issue. Не публикуйте raw provider payload и контакты работодателей или соискателей.

Перед отдельным production-развёртыванием нужны новая пустая БД, новые secrets/cookies и PostgreSQL credentials, `DEMO_MODE=false`, TLS, централизованные alerts, off-host backup и процедура ротации ключей. Production bootstrap отказывается продолжать при известных demo-аккаунтах или включённом demo source.
