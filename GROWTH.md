# Продвижение TechRole Index без спама

## Принцип

Цель — стать удобным первичным источником, на который естественно ссылаются люди, поисковые системы и AI-ответы. Сеть пустых сайтов, массовые комментарии, покупные ссылки, doorway pages и автоматические регистрации не используются: они не добавляют доказательности и создают риск санкций.

Официальная документация Google для AI-функций не требует особой «AI-разметки»: нужны индексируемый полезный текст, внутренние ссылки и structured data, совпадающие с видимым содержимым. Для Dataset Google рекомендует стандартизированные metadata, sitemap, provenance и проверку разметки. Источники: [AI features](https://developers.google.com/search/docs/appearance/ai-features), [Dataset structured data](https://developers.google.com/search/docs/appearance/structured-data/dataset).

## Уже сделано

- 50 SSR-страниц профессий, категории, методология, глоссарий, источники и internal linking;
- `Dataset` / `DataCatalog` / `DataDownload` / `Occupation` / `Report` JSON-LD;
- sitemap, robots, RSS, canonical URL, Open Graph/Twitter image и manifest;
- `llms.txt`, `llms-full.txt`, `ai-index.json`, `open-data.json`, `research.json`;
- Croissant 1.1 metadata для daily dataset: 30 фактических CSV-колонок, типы, составной ключ, live-dataset semantics, provenance и применимые типовые условия открытых данных; официальный `mlcroissant 1.1.0` выполняет validate и загружает пробные записи;
- W3C DCAT 3 каталог с Dataset, прямыми JSON/CSV distributions, публичным DataService, provenance и условиями использования;
- W3C CSV on the Web metadata с 30 фактическими колонками, datatypes, nullable cells, составным primary key и автоматическим обнаружением через HTTP `Link`;
- англоязычная `DATASET_CARD.md` фиксирует grain, lineage, intended/out-of-scope use, privacy, missingness, attribution и воспроизводимый citation checklist для репозиториев и data-каталогов;
- отдельный исследовательский обзор с динамическими агрегатами официального 180-дневного слоя;
- индексируемая страница статуса и JSON provenance, которые явно отделяют prepared baseline от observed historical;
- изолированная incremental SQL-витрина официальных публикаций с проверяемыми date/source/tax-status slices и версией transform;
- открытый CSV с 150 seniority-срезами, периодом, n, confidence, tax status и canonical URL;
- индексируемая `/open-data-daily`, daily JSON/CSV и строгий JSON Schema Draft 2020-12 из materialized observed layer: creation-date, профессия, seniority, регион, tax status, полный словарь 27 полей, null-safe salary gate и transform version;
- SHA-256 ETag, `Last-Modified` и корректный `304 Not Modified` для daily JSON/CSV/Schema, чтобы краулеры могли проверять обновление без повторной передачи всего набора;
- страница цитирования, CSL-JSON, BibTeX, RIS и Frictionless Data Package;
- CORS для открытых JSON-ресурсов и `Link: rel="cite-as"` / `describedby`;
- безопасный IndexNow key endpoint и submit-скрипт, который принимает только URL канонического host из sitemap;
- публичный production-preview с внешним smoke, но без поисковой регистрации временного URL.

## Порядок запуска после стабильного домена

1. Развернуть production с сильными секретами, `DEMO_MODE=false`, TLS, backup и observability.
2. Зафиксировать одинаковый `NEXT_PUBLIC_SITE_URL`, `PUBLIC_BASE_URL`, `FRONTEND_ORIGIN`, проверить все canonical и 70+ URL sitemap.
3. Подтвердить домен в Google Search Console; отправить sitemap и проверить Dataset markup/URL inspection.
4. Подтвердить домен в Bing Webmaster Tools и Яндекс Вебмастере по актуальным официальным инструкциям.
5. Сгенерировать отдельный `INDEXNOW_KEY`, пересобрать frontend и запустить `submit-indexnow.ps1`. Официальный протокол: <https://www.indexnow.org/documentation>.
6. Создать новый очищенный public history без baseline-версий Windows/Tailscale details и без `.env`; включить CI, security scanning и ссылку на canonical сайт. Текущий tracked head уже вынес machine-specific значения в игнорируемый `LOCAL_OPERATIONS.md`, но старый commit нельзя публиковать как есть.
7. Опубликовать одну сильную техническую статью о методологии и одну исследовательскую статью по данным. Каждая цифра ведёт на конкретную профессию или `/research`, а метод — на `/methodology`.
8. Только после проверки прав/лицензии разместить собственные агрегаты и metadata в подходящем data-каталоге. Raw provider payload не выгружать.

## Бесплатные содержательные каналы

- публичный GitHub: код методологии, SQL-модели, tests, CITATION и ссылка на сайт;
- технические площадки: статья «Как не смешивать gross, net и неизвестный налоговый статус»;
- карьерные сообщества: разбор одной роли с воспроизводимой ссылкой, а не рекламный пост;
- образовательные программы: методический материал для выбора специализации и словарь метрик;
- профили автора/проекта: единое описание, canonical URL и контакт;
- RSS и Telegram-канал обновлений: одна запись на реальное изменение данных или методики;
- партнёрские материалы с карьерными консультантами и школами только с явным раскрытием и без обмена массовыми ссылками;
- Dataset discovery через schema.org metadata, открытый Data Package и MLCommons Croissant 1.1.

Перед регистрацией на любой площадке повторно проверить её актуальные правила, права на данные и разрешённую атрибуцию.

## Темы первых 12 материалов

Опубликованы двенадцать самостоятельных разборов: закрыты все темы 1-12, а различие gross/net/unknown вынесено в отдельное основание внутри корпуса. Материалы доступны через `/insights`, Article JSON-LD, RSS, sitemap, `insights.json`, `ai-index.json` и LLM-указатели; каждая статья имеет собственные CSL-JSON, BibTeX и RIS. Дальнейшие темы добавляются только при новом проверяемом вопросе и не размножаются в короткие doorway-страницы.

1. 180 дней публикаций IT-вакансий: что действительно измеряет ряд.
2. Почему «Недостаточно данных» лучше красивого нуля.
3. Медиана против среднего на зарплатных вилках.
4. Junior/Middle/Senior: как заголовок и опыт дают разные сигналы.
5. 17 узких ролей без уверенных совпадений — как читать такой результат.
6. Как устроен индекс профессии 0–100 и почему это не карьерное обещание.
7. Публикации против одновременно активных вакансий.
8. Как сохранять provenance и не приписывать запись чужому источнику.
9. Почему официальный курс валюты обязан иметь requested и effective date.
10. Как серверный paywall защищает Premium-метрики в SSR и JSON-LD.
11. Что LLM-friendly означает на практике: открытый текст, Dataset и citation metadata.
12. Воспроизводимый ETL: Dagster run history, quality gate и честные ошибки.

## Готовые описания

Короткое:

> TechRole Index — русскоязычная аналитика 50 IT-профессий: спрос, зарплаты по уровням, динамика, стек и прозрачная методология. Официальные открытые публикации показываются отдельно с периодом, выборкой и provenance.

Для статьи:

> TechRole Index помогает сравнивать IT-роли по проверяемым показателям. Сервис не смешивает подготовленную gross-витрину с источником, где налоговый статус неизвестен, показывает «Недостаточно данных» при малой выборке и публикует методологию, открытые JSON-ресурсы и готовые форматы цитирования.

## Метрики роста

- число проиндексированных canonical URL и ошибки coverage;
- organic impressions/clicks на профессии и research queries;
- внешние домены, которые ссылаются на конкретный полезный материал;
- переходы на описание `/open-data-daily` и обращения к `open-data.json`, daily JSON/CSV/Schema/Croissant, `research.json`, citation formats и RSS;
- доля условных запросов к daily dataset, завершившихся `304`, и сэкономленный объём передачи;
- доля запросов с брендированным поиском TechRole Index;
- корректность цитат: сохранены ли период, n, источник и оговорка;
- Core Web Vitals и доступность production страниц.

Локальный и preview-контроль автоматизирован: `npm run audit:public` обходит каждый HTML URL из sitemap, а Playwright проверяет семантическую доступность representative pages, keyboard skip-link, mobile overflow, reduced motion и lab budgets TTFB/FCP/LCP/CLS/event duration. Внешний smoke дополнительно загружает каждый CSS/JS asset главной и проверяет Dataset landing. Это предотвращает техническую деградацию до появления стабильного домена, но не заменяет полевые p75 Core Web Vitals из реального трафика.

Количество созданных ссылок само по себе не является целевой метрикой.
