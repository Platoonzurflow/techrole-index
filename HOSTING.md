# Постоянный домен и размещение TechRole Index

Актуальность условий и публичных цен проверена 2026-07-22 по официальным страницам провайдеров. Тарифы меняются, поэтому итоговую сумму нужно повторно сверить в корзине до оплаты.

## Короткий вывод

Для текущего полного стека нет добросовестного serverless-варианта «навсегда бесплатно» без существенной переделки или риска потери данных. Конкретный недорогой вариант для владельца из России:

1. Домен `techrole.ru`: на момент WHOIS-проверки 22.07.2026 свободен. У Timeweb регистрация `.ru` показана как 200 ₽, продление — 399 ₽; у Beget — 199/420 ₽. Разница в 1 ₽ несущественна, поэтому практичнее Timeweb с более дешёвым продлением. Доступность может измениться в любую минуту.
2. VPS Timeweb Cloud `2 vCPU / 4 ГБ / 50 ГБ` в российском регионе: официальный конфигуратор показал вариант от 721 ₽/месяц; московский вариант того же размера — 1 000 ₽/месяц. Для текущего production-набора этого достаточно: контейнеры без Next dev занимают около 1 ГБ RAM, но нужен swap и сборка через CI.
3. До покупки продолжать использовать Tailscale Funnel только как preview. Он бесплатен и даёт HTTPS, но webhook и сайт пропадут при выключении домашнего ПК.

Итого минимальный проверенный бюджет первого года — примерно 8 852 ₽: домен 200 ₽ + 12 × 721 ₽. Это ориентир без акций, резервных копий и возможных платных опций.

FunPay для домена не выбран: подтверждённого предложения официального регистратора дешевле 199–200 ₽ не найдено, а покупка домена или аккаунта у посредника создаёт риск, что владельцем/администратором в реестре останется продавец. Домен нужно регистрировать лично на свои паспортные данные в аккаунте аккредитованного регистратора.

Tailscale Funnel остаётся beta, имеет не настраиваемый bandwidth limit и зависит от включённого ПК. Его нельзя выдавать за отказоустойчивый production, но он заметно надёжнее вращающегося анонимного `*.lhr.life` preview. Официальные ограничения: [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) и [CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel).

## Проверенные варианты

| Вариант | Что доступно бесплатно | Ограничение для этого проекта | Решение |
|---|---|---|---|
| Tailscale Funnel | HTTPS `*.ts.net` на всех планах | Beta, только tailnet-domain, bandwidth limit, домашний host должен работать | Немедленный стабильный публичный preview |
| Cloudflare Tunnel | Zero Trust Free заявлен как `$0 forever`; tunnel создаёт outbound-only соединение без открытых inbound ports | Для нормального hostname нужен собственный домен в Cloudflare; у free plan нет production SLA | Предпочтительный ingress после появления домена |
| Timeweb Cloud | Российский VPS 2 vCPU/4 ГБ/50 ГБ от 721 ₽/месяц по конфигуратору 22.07.2026 | Платный; внешний backup оплачивается/настраивается отдельно | Основной недорогой production-вариант |
| Beget VPS | 2 vCPU/4 ГБ/40 ГБ — 33 ₽/день плюс публичный IPv4 5 ₽/день, около 1 140 ₽ за 30 дней | Дороже Timeweb для выбранной конфигурации | Резервный российский VPS |
| Oracle Cloud Always Free | Ampere A1 может дать бесплатные ресурсы в поддерживаемом home region | Нужны личная регистрация, карта и доступная ёмкость; аккаунт/регион для владельца из РФ не подтверждены, idle VM может быть изъята | Только необязательная попытка, не план запуска |
| Render Free | Free web service и 1 ГБ PostgreSQL | PostgreSQL истекает через 30 дней, без backup; free filesystem ephemeral | Не использовать для основной БД |
| Koyeb Free | Один web instance: 0,1 vCPU, 512 МБ RAM, 2 ГБ SSD | Засыпает через час, без worker service и persistent volume; docs прямо не рекомендуют production | Не подходит полному стеку |

Источники: [домены Timeweb](https://timeweb.com/ru/services/domains/), [домены Beget](https://beget.com/ru/domains), [VPS Timeweb Cloud](https://timeweb.cloud/services/cloud-servers), [VPS Beget](https://beget.com/ru/vps), [Cloudflare Free plan](https://www.cloudflare.com/plans/zero-trust-services/), [Cloudflare named Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), [OCI Free Tier](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm), [Render Free](https://render.com/docs/free), [Koyeb Free instance](https://www.koyeb.com/docs/reference/instances).

## Этап 1: стабильный Funnel preview

Предварительно должны быть healthy `public-frontend` и `public-proxy` из `compose.public.yaml`. Funnel нельзя направлять на Next dev server, backend, PostgreSQL, Redis или RDP.

```powershell
docker compose -f compose.yaml -f compose.public.yaml --profile public up -d public-frontend public-proxy
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\windows\start-public-funnel.ps1
```

При первом запуске Tailscale покажет официальный URL подтверждения владельца tailnet. После подтверждения повторите сценарий. Результат сохраняется вне репозитория в `%LOCALAPPDATA%\TechRoleIndex\public-funnel-status.json`.

Полученный URL нужно использовать как единый canonical при новой immutable сборке:

```powershell
$url = (Get-Content -Raw "$env:LOCALAPPDATA\TechRoleIndex\public-funnel-status.json" | ConvertFrom-Json).url
$slot = '.next-public-tsnet'
docker compose run --rm --no-deps -e NEXT_DIST_DIR=$slot -e NEXT_PUBLIC_SITE_URL=$url -e NEXT_PUBLIC_DATA_MODE=observed frontend npm run build:standalone
$env:PUBLIC_BUILD_DIR = ".\frontend\$slot"
$env:NEXT_PUBLIC_SITE_URL = $url
$env:NEXT_PUBLIC_DATA_MODE = 'observed'
docker compose -f compose.yaml -f compose.public.yaml --profile public up -d --no-deps --force-recreate public-frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\windows\test-public-preview.ps1 -BaseUrl $url
```

Перед постоянным запуском в игнорируемом `.env` должны совпасть `SITE_ADDRESS`, `PUBLIC_BASE_URL`, `FRONTEND_ORIGIN` и `NEXT_PUBLIC_SITE_URL`; также сохраните `PUBLIC_BUILD_DIR` и не-demo `NEXT_PUBLIC_DATA_MODE`. После смены origin пересоздайте backend, worker, scheduler и Dagster, иначе CSRF/CORS и ссылки в письмах останутся привязаны к старому адресу. Секретные строки `.env` при этом не печатайте и не коммитьте.

После успешного smoke проверьте `sitemap.xml`, `robots.txt`, `llms.txt`, `open-data-daily.schema.json`, canonical всех HTML-страниц и отправку обеих публичных форм. Пока host зависит от домашнего ПК и Funnel beta, Search Console и массовую раздачу ссылок лучше не начинать.

Если для диагностики параллельно запускался Cloudflare Quick Tunnel, после переключения canonical остановите только записанный им процесс: `powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\windows\stop-public-quick-tunnel.ps1`. Скрипт сверяет PID и полный путь `cloudflared.exe`, отмечает runtime status остановленным и не изменяет Tailscale Funnel.

## Этап 2: домен и VPS

1. Лично зарегистрировать `techrole.ru` на свои данные; не покупать чужой аккаунт регистратора. Включить двухфакторную защиту и запрет/подтверждение трансфера.
2. Создать чистую Ubuntu 24.04 VM минимум с 2 vCPU/4 ГБ/40–50 ГБ и отдельным SSH key. Добавить 2–4 ГБ swap; собирать immutable frontend в CI, чтобы не держать Next build на production постоянно.
3. Разрешить inbound только 22 с административного IP и 80/443 для Caddy. PostgreSQL, Redis, backend и Dagster наружу не публиковать.
4. Установить Docker Engine/Compose из официального репозитория, скопировать Git checkout и новый `.env` без demo credentials.
5. Перенести dump и обязательно прогнать isolated restore drill до переключения DNS.
6. Запустить production overlay, проверить fail-closed validator, health endpoints, nightly schedule, SMTP, webhook и backup.
7. Только после внешнего smoke переключить домен, отправить sitemap, IndexNow и начать содержательное продвижение.

Always Free не означает SLA. Нужны внешний uptime monitor, зашифрованный off-host backup и план переноса на другой host.

## Этап 3: цитируемость и продвижение

Не создавать сетку пустых сайтов и не рассылать автоматический ссылочный спам. Такие ссылки не дают проверяемой репутации и могут навредить домену. Рабочий бесплатный набор после стабильного canonical host:

1. Публичный GitHub repository с README, методологией, Data Package, JSON Schema и DOI-ready release archive.
2. Регистрация sitemap в Google Search Console, Bing Webmaster Tools и Яндекс Вебмастере; IndexNow только с ключом на том же host.
3. Содержательные статьи с воспроизводимыми запросами, ограничениями выборки и готовыми BibTeX/RIS/CSL-JSON ссылками.
4. Размещение набора в законных каталогах open data/research software, где разрешена такая тематика и есть редакционная модерация.
5. Партнёрские материалы для карьерных сообществ, вузов и авторов исследований вместо искусственных backlinks.
6. Ежемесячный публичный changelog данных, schema version и проверки качества; исправления должны сохранять стабильные URL.

Подробная белая стратегия описана в `GROWTH.md`.
## Current production status (2026-07-22)

- Canonical host: `https://techrole.ru` (Selectel VDS `94.102.88.123`).
- DNS zone is managed in Selectel. Apex `A` points to `94.102.88.123`; `www` is a `CNAME` to `techrole.ru.`.
- Caddy serves the canonical host and redirects the former `sslip.io` address and `www` to the apex.
- The domain registration is active through 2027-07-22. DNS delegation can take time after registrar verification; do not enable live payments until the new HTTPS host passes the external smoke checks.
