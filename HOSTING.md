# Бесплатное размещение TechRole Index

Актуальность условий проверена 2026-07-21 по официальной документации провайдеров. Free tier меняется, поэтому перед переносом нужно повторно сверить лимиты.

## Короткий вывод

Для текущего полного стека нет добросовестного serverless-варианта «навсегда бесплатно» без существенной переделки или риска потери данных. Практический маршрут состоит из двух этапов:

1. Публичный стабильный preview через Tailscale Funnel на уже работающем Windows-host. Адрес `*.ts.net` не меняется при перезапуске Funnel, TLS выдаётся автоматически, наружу проксируется только `127.0.0.1:3199`.
2. Полноценный 24/7-host на OCI Always Free Ampere A1 либо на платном VPS. Канонический домен лучше держать в Cloudflare и направлять через named Tunnel или обычный Caddy DNS/IP route.

Tailscale Funnel остаётся beta, имеет не настраиваемый bandwidth limit и зависит от включённого ПК. Его нельзя выдавать за отказоустойчивый production, но он заметно надёжнее вращающегося анонимного `*.lhr.life` preview. Официальные ограничения: [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) и [CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel).

## Проверенные варианты

| Вариант | Что доступно бесплатно | Ограничение для этого проекта | Решение |
|---|---|---|---|
| Tailscale Funnel | HTTPS `*.ts.net` на всех планах | Beta, только tailnet-domain, bandwidth limit, домашний host должен работать | Немедленный стабильный публичный preview |
| Cloudflare Tunnel | Zero Trust Free заявлен как `$0 forever`; tunnel создаёт outbound-only соединение без открытых inbound ports | Для нормального hostname нужен собственный домен в Cloudflare; у free plan нет production SLA | Предпочтительный ingress после появления домена |
| Oracle Cloud Always Free | Ampere A1 суммарно до 2 OCPU/12 ГБ RAM и 200 ГБ block storage в home region | Нужны регистрация с телефоном/картой; возможен `out of host capacity`; idle VM может быть изъята | Лучший найденный `$0` VM-host для полного Compose |
| Render Free | Free web service и 1 ГБ PostgreSQL | PostgreSQL истекает через 30 дней, без backup; free filesystem ephemeral | Не использовать для основной БД |
| Koyeb Free | Один web instance: 0,1 vCPU, 512 МБ RAM, 2 ГБ SSD | Засыпает через час, без worker service и persistent volume; docs прямо не рекомендуют production | Не подходит полному стеку |

Источники: [Cloudflare Free plan](https://www.cloudflare.com/plans/zero-trust-services/), [Cloudflare named Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), [Cloudflare outbound connectivity](https://developers.cloudflare.com/cloudflare-one/networks/connectivity-options/), [OCI Free Tier](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm), [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Render Free](https://render.com/docs/free), [Koyeb Free instance](https://www.koyeb.com/docs/reference/instances).

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

## Этап 2: OCI Always Free или VPS

1. Создать чистую Ubuntu VM, предпочтительно Ampere A1 с 2 OCPU/12 ГБ, и отдельный SSH key.
2. Разрешить inbound только 22 с административного IP и 80/443 для Caddy. PostgreSQL, Redis, backend и Dagster наружу не публиковать.
3. Установить Docker Engine/Compose из официального репозитория, скопировать Git checkout и новый `.env` без demo credentials.
4. Перенести dump и обязательно прогнать `test-postgres-restore.ps1` до переключения DNS; на Linux выполнить эквивалентный isolated restore drill.
5. Запустить production overlay, проверить fail-closed validator, health endpoints, nightly schedule, SMTP и backup.
6. Только после внешнего smoke переключить домен, отправить sitemap, IndexNow и начать содержательное продвижение.

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
