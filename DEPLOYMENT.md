# Развёртывание и эксплуатация

## Local-dev

`docker compose up --build`. Default services — local-dev, включая Dagster webserver/daemon; профиль `local-dev` дополнительно включает одноразовый `dev-tests`. Профиль `ai` не обязателен. Dagster UI доступен только на loopback `127.0.0.1:3001`, а schedule `techrole_midnight_moscow` должен отображаться как `RUNNING`.

## Production

### Платежи

До реальных списаний выполните отдельный checklist из [PAYMENTS.md](PAYMENTS.md). Tailscale Funnel не считается круглосуточным платёжным ingress: он зависит от включённого Windows-компьютера. Для основного варианта нужен постоянный HTTPS origin с webhook `/api/v1/payments/webhooks/robokassa`, законченный KYC/договор и подключённые «Робочеки СМЗ».

Безопасный локальный preview использует `PAYMENTS_PROVIDER=demo`, `PAYMENTS_MODE=test`, `PAYMENTS_LIVE_CONFIRMED=false` и `PAYMENTS_LEGAL_APPROVED=false`. Для test shop Robokassa MerchantLogin и тестовые Пароли №1/№2 хранятся только в `.env`/secret store; Password3 нужен только live refund API. Миграция `0006` должна быть применена до запуска backend.

Production guard требует отдельные live credentials, явные `PAYMENTS_LIVE_CONFIRMED=true`, `PAYMENTS_LEGAL_APPROVED=true` и `PAYMENTS_STABLE_HTTPS_CONFIRMED=true`, утверждённую версию оферты, статус продавца и схему чеков. Последний флаг выставляется только после проверки постоянного домена, TLS и круглосуточного host; временный Funnel его не заменяет. Для подтверждённого НПД + Robokassa обязателен `PAYMENTS_FISCALIZATION_MODE=robokassa`; для резервной ЮKassa — ручной контур «Мой налог». Robokassa live принимает только официальные payment/refund endpoints и отдельный Password3. VAT-aware Robokassa receipts для ИП/компании намеренно заблокированы до отдельной реализации. Любое несовпадение завершает backend до приёма трафика.

Перед переключением проверьте `/admin`: раздел «Готовность Robokassa» должен быть зелёным сначала для test shop, затем для live. Endpoint `/api/v1/admin/payment-readiness` доступен только администратору и намеренно не раскрывает значения credentials.

Для почтовой доставки обращений поддержки задайте `SUPPORT_EMAIL_ENABLED=true`, а для nightly-отчётов - `NIGHTLY_REPORT_EMAIL_ENABLED=true`. Оба контура используют `SUPPORT_RECIPIENT_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` и `SMTP_USE_SSL` через secret environment. Не помещайте SMTP-пароль в Compose-файл или образ. Темы различаются: `[TechRole Support]`, `[TechRole Mentorship]`, `[TechRole Nightly]`.

1. На отдельном deployment-host скопировать `.env.example` в неотслеживаемый `.env` и заменить credentials. Обязательны новый `APP_SECRET_KEY` длиной от 32 символов, `POSTGRES_DB`, `POSTGRES_USER`, случайный `POSTGRES_PASSWORD` длиной от 16 символов и совпадающий URL-encoded `DATABASE_URL`.
2. Установить `DEMO_MODE=false`, `APP_ENV=production` и один HTTPS origin в `SITE_ADDRESS`, `PUBLIC_BASE_URL`, `FRONTEND_ORIGIN` и `NEXT_PUBLIC_SITE_URL`. `NEXT_PUBLIC_DATA_MODE` не должен быть `demo`.
3. Использовать новую пустую production-БД. Текущий local volume содержит известные demo-аккаунты и подготовленные synthetic metrics; production seed намеренно откажется запускаться на нём. На пустой БД seed создаёт 50 профессий, aliases, уровни, регионы и source/scoring reference без demo-пользователей, вакансий и метрик.
4. Проверить отрендеренный fail-closed контракт (требуется Node.js 20+):

```powershell
docker compose -f compose.yaml -f compose.production.yaml --profile production config --format json | node infra/validate-production-config.mjs
```

5. Запустить `docker compose -f compose.yaml -f compose.production.yaml --profile production up --build -d`.
6. Проверить `/health/live`, `/api/v1/health/ready`, `/status`, Celery ping, `dagster-daemon liveness-check`, расписание в Dagster и Caddy TLS. Production validator также требует, чтобы Next.js standalone получил `INTERNAL_API_URL=http://backend:8000` одновременно как build arg и runtime environment.

Валидатор требует, чтобы только Caddy публиковал host-порты 80/443, backend/worker/scheduler/Dagster не монтировали исходники в `/app`, Gunicorn работал с `APP_ENV=production`, а Caddy, frontend build/runtime и backend использовали один HTTPS origin. Те же проверки выполняются в CI на синтетических production credentials. Backend дополнительно завершает любой процесс до старта, если обнаруживает demo mode, localhost/HTTP origin, известный/короткий secret или слабый PostgreSQL password.

Изменение `POSTGRES_PASSWORD` в Compose не меняет пароль уже инициализированного PostgreSQL volume. Для существующей production-БД сначала выполните контролируемую ротацию роли в PostgreSQL и синхронно обновите `DATABASE_URL`; local demo volume не преобразовывать в production автоматически.

Production не публикует PostgreSQL, Redis, backend или Dagster UI и не bind-mount-ит исходный код приложения. Firewall должен пропускать только 80/443. Для реального HA вынести PostgreSQL/Redis и Dagster instance storage в managed/private services, добавить replicas и observability.

Production backend запускает два Gunicorn workers с Prometheus multiprocess-файлами в container tmpfs. `/metrics` не проксируется Caddy во внешний сайт. Внутренний сборщик можно запустить отдельным loopback-only профилем:

```powershell
docker compose -f compose.yaml -f compose.observability.yaml --profile observability up -d prometheus
```

Prometheus UI и rules сами по себе не отправляют уведомления: Alertmanager и защищённый канал доставки настраиваются отдельно после выбора владельцем.

Catalog/detail cache включается `CATALOG_CACHE_ENABLED=true`; production override включает его явно. Ключи хешируются, public/premium разделены, TTL задаётся `CATALOG_CACHE_TTL_SECONDS` (по умолчанию 120 секунд). Redis остаётся оптимизацией: при его недоступности чтение fail-open идёт в PostgreSQL, а auth rate limit по-прежнему fail-closed в production.

## Безопасный удалённый доступ к Windows-хосту

Рекомендуемая схема: Tailscale на домашнем ПК, ноутбуке и iPhone плюс встроенный Remote Desktop Windows Pro. Порт 3389 нельзя пробрасывать на роутере или открывать для Public-сети.

1. Установить подписанный установщик Tailscale и войти в один аккаунт на всех устройствах.
2. На iPhone установить Tailscale и Windows App, на ноутбуке - Tailscale и RDP-клиент.
3. На домашнем ПК от имени администратора запустить `infra/windows/enable-private-remote-access.ps1`.
4. Подключаться в Windows App по Tailscale IPv4-адресу ПК. Учётная запись Windows должна иметь пароль; Windows Hello PIN не заменяет пароль для обычной RDP-аутентификации.

Machine-specific Tailscale IP, MagicDNS и Windows username хранятся только в игнорируемом `LOCAL_OPERATIONS.md`. На iPhone откройте Windows App Mobile, нажмите `+` → PC, укажите приватный адрес оттуда, Gateway оставьте пустым и войдите паролем Windows. После последнего изменения сценария его нужно один раз повторно запустить от администратора, чтобы перезапустить TermService и увидеть `ListenerReady=True`:

```powershell
cd "<workspace>\full-stack-data-engineer-ux-mvp"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\infra\windows\enable-private-remote-access.ps1"
```

ПК видит iPhone в tailnet, сон и гибернация от сети отключены. Не отключайте Tailscale и не открывайте 3389 на роутере.

Сценарий оставляет NLA включённой, не включает широкие встроенные правила и создаёт только два входящих правила, ограниченных интерфейсом Tailscale и диапазоном `100.64.0.0/10`. Откат: `infra/windows/disable-private-remote-access.ps1` от имени администратора.

## Бесплатный публичный HTTPS и индексация

Tailscale Funnel доступен на всех тарифах и может выдать публичный HTTPS-адрес `*.ts.net`, но он остаётся beta, зависит от включённого домашнего ПК и имеет ограничения пропускной способности. Он подходит для закрытого предпросмотра после production-сборки, но не заменяет стабильный production-host. Текущий Next.js dev-сервер намеренно не опубликован.

Для публикации только loopback production-proxy используйте `infra/windows/start-public-funnel.ps1`. Сценарий жёстко принимает только `http://127.0.0.1:3199`, проверяет proxy до изменения Funnel, затем проверяет 50 сущностей с внешнего `*.ts.net` URL и сохраняет локальный status. Первый запуск потребует подтвердить Funnel в официальном Tailscale UI. Актуальное сравнение бесплатных host-вариантов и команды canonical rebuild находятся в `HOSTING.md`.

После выбора канонического публичного HTTPS-host задайте одинаковый `NEXT_PUBLIC_SITE_URL`, `PUBLIC_BASE_URL` и `FRONTEND_ORIGIN`, затем проверьте `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/open-data.json` и canonical URL. Бесплатно можно зарегистрировать sitemap в Google Search Console, Bing Webmaster Tools и Яндекс Вебмастере после подтверждения владения host. Для Bing/других участников можно добавить IndexNow после размещения key-файла на публичном host. Localhost и временный меняющийся URL регистрировать нельзя.

Публичный preview запускается только из production standalone на loopback-порту 3100. Перед ним постоянно работает минимальный Node reverse proxy на `127.0.0.1:3199`; SSH tunnel подключается к proxy, поэтому краткий recreate upstream не закрывает локальный listener. Анонимный localhost.run всё равно может ротировать временный hostname внутри живого SSH-процесса. Перед сборкой canonical вызовите `infra/windows/refresh-public-tunnel-status.ps1`: он берёт последний URL из логов, проверяет 50 сущностей и сохраняет историю прежних адресов. Активный immutable build slot задаётся `PUBLIC_BUILD_DIR` (по умолчанию `.next-public-live`), поэтому новый standalone сначала собирается в соседний `.next-*` каталог, а Compose переключается на него только после успеха. После `next build` обязательно выполните `npm run prepare:standalone` с тем же `NEXT_DIST_DIR`: Next не копирует browser assets из `<dist>/static` в standalone автоматически, а без них HTML отвечает 200, но CSS и hydration получают 404. Это обходит Windows bind-mount lock и сохраняет предыдущий каталог для отката без перемещения файлов. Скрипт `infra/windows/start-public-ssh-tunnel.ps1` создаёт временный `*.lhr.life` HTTPS-туннель к 3199 и сохраняет status вне репозитория в `%LOCALAPPDATA%\TechRoleIndex`. Внешний smoke выполняется `infra/windows/test-public-preview.ps1 -BaseUrl <https-url>` и отдельно требует HTTP 200 для всех CSS/JS главной страницы. Временный адрес предназначен для проверки и показа, а не для Search Console, IndexNow или постоянных внешних ссылок.

Безопасное переключение preview upstream:

```powershell
docker compose -f compose.yaml -f compose.public.yaml --profile public up -d public-proxy
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\windows\refresh-public-tunnel-status.ps1
docker compose run --rm --no-deps -e NEXT_DIST_DIR=.next-public-live frontend npm run build:standalone
docker compose -f compose.yaml -f compose.public.yaml --profile public up -d --no-deps --force-recreate public-frontend
```

`public-proxy` не пересоздаётся второй командой. Изолированный `next build` лучше запускать одноразовым frontend-контейнером без одновременно работающего `next dev`, чтобы не делить 2 ГБ cgroup между двумя Node-процессами.

После появления стабильного канонического домена сгенерируйте отдельный `INDEXNOW_KEY`, сохраните его только в production secret environment, пересоберите frontend и проверьте `/indexnow-key.txt`. Затем один раз отправьте URL из sitemap официальному endpoint:

```powershell
$env:INDEXNOW_KEY = '<8-128 letters, numbers or dashes>'
powershell -NoProfile -ExecutionPolicy Bypass -File '.\infra\windows\submit-indexnow.ps1' -BaseUrl 'https://example.com'
```

Скрипт сверяет публичный key-файл, принимает только URL того же host, ограничен содержимым sitemap и намеренно отклоняет localhost, `*.lhr.life` и `*.trycloudflare.com`. Протокол и статусы ответов: <https://www.indexnow.org/documentation>.

Внешние ссылки получают через содержательные публикации и справочники: публичный GitHub проекта, техническая статья о методологии, профиль автора, тематические каталоги и партнёрские материалы. Автоматический массовый спам ссылками не используется: он не создаёт доверия и может ухудшить поисковую репутацию.

## Backup PostgreSQL

Создать согласованный backup:

```powershell
New-Item -ItemType Directory -Force backups
docker compose exec postgres pg_dump -U <POSTGRES_USER> -d <POSTGRES_DB> -Fc -f /tmp/techrole.dump
docker compose cp postgres:/tmp/techrole.dump backups/techrole.dump
```

Храните backup шифрованным вне host, задайте retention и регулярно проверяйте restore. Не коммитьте dump.

Для локального согласованного backup с SHA-256 manifest и 14-дневным retention используйте `infra/windows/backup-postgres.ps1`. Скрипт читает фактические `POSTGRES_USER` и `POSTGRES_DB` из контейнера, поэтому подходит и для production credentials. Он сохраняет файлы только в игнорируемый каталог `backups/` внутри workspace; это оперативная копия на том же диске, а не замена шифрованной off-host копии.

Сразу после создания проверьте не только структуру архива, но и полный restore в изолированную временную БД:

```powershell
$backup = .\infra\windows\backup-postgres.ps1
.\infra\windows\test-postgres-restore.ps1 -DumpPath $backup.file -ManifestPath $backup.manifest
```

Restore-test сверяет размер и SHA-256 с manifest, создаёт БД только с префиксом `techrole_restore_`, восстанавливает архив без смены владельца, проверяет Alembic revision и ключевые таблицы и удаляет тестовую БД. Основная БД и работающие сервисы не останавливаются. Dump и manifest обязаны находиться внутри workspace; для disaster recovery дополнительно храните зашифрованную копию на другом устройстве или в object storage.

## Restore

Восстановление перезаписывает целевую БД; выполняйте только в подтверждённую пустую/восстановительную среду:

```powershell
docker compose stop backend worker scheduler frontend
docker compose cp backups/techrole.dump postgres:/tmp/techrole.dump
docker compose exec postgres pg_restore -U <POSTGRES_USER> -d <POSTGRES_DB> --clean --if-exists /tmp/techrole.dump
docker compose up -d backend worker scheduler frontend
```

Перед production restore зафиксируйте точный target, сделайте текущий backup и проверьте миграционную совместимость.

## Rollback

Приложение разворачивается immutable images. Сначала откатить image tags; Alembic downgrade выполнять только если revision явно помечена обратимой и создан backup. `0001` downgrade удаляет всю схему и предназначен только для тестовой проверки миграций.
## Permanent public host

Production is served from Selectel VDS `94.102.88.123` at `https://techrole.ru`. Selectel DNS records are `A @ -> 94.102.88.123` and `CNAME www -> techrole.ru.`. Caddy provisions HTTPS automatically and redirects the legacy `sslip.io` address to the apex. Keep `PAYMENTS_LIVE_ENABLED=false` until the owner completes the Robokassa legal and operational checks.
