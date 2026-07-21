# Локальные метрики и alerts

Prometheus запускается отдельным профилем и публикует UI только на loopback `127.0.0.1:9090`. Backend endpoint `/metrics` не проходит через публичный frontend/Caddy.

```powershell
docker compose -f compose.yaml -f compose.observability.yaml --profile observability up -d prometheus
```

Собираются только HTTP counter/histogram с bounded labels: method, route template и status class. Query string, фактический slug, IP, request ID, email и body не экспортируются.

`alerts.yml` проверяет недоступность backend, общую долю 5xx, агрегированный p95 и ошибки fail-open cache. Правила видны в Prometheus UI, но внешняя доставка уведомлений намеренно не настроена: для неё нужен отдельный Alertmanager и выбранный владельцем защищённый канал.
