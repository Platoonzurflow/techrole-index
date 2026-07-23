# Поиск и AI-цитирование TechRole Index

Актуальность аудита: 23 июля 2026 года. Цель слоя discoverability — дать поиску и AI-поиску одинаковый открытый, видимый человеку и проверяемый материал. Ни один файл, метатег или crawler rule не гарантирует индексацию, позицию или цитирование.

## Публичный контракт

- канонический origin: `https://techrole.ru`;
- sitemap и robots: `/sitemap.xml`, `/robots.txt`;
- answer-first HTML/JSON: `/answers`, `/answers.json` со стабильными фрагментами, периодом, `n`, tax status, источником и provenance;
- основной открытый слой: `/open-data.json`, `/open-data.csv`, `/open-data-daily*`;
- описание и происхождение: `/methodology`, `/sources`, `/data-status`, `/data-status.json`;
- библиография: `/citation`, CSL-JSON, BibTeX и RIS;
- discovery: RSS, DCAT 3, CSVW, Croissant 1.1, Data Package, Linkset и `ai-index.json`;
- `llms.txt`, `llms-full.txt` и `/.well-known/llms.txt` — дополнительные указатели, а не стандарт индексации.

Динамические machine endpoints не публикуют правдоподобный пустой датасет при недоступном backend: они отвечают `503`, `Cache-Control: no-store` и `Retry-After`. Стабильные ответы имеют SHA-256 `ETag`, где возможно — `Last-Modified`, и поддерживают `304`. Форматы доступны по явным suffix URL и объявлены через HTML `alternate`, HTTP `Link`, JSON-LD distributions и Linkset; автоматическому клиенту не нужно угадывать формат по `Accept`.

## Проверенные официальные правила

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — действуют обычные требования Search: индексируемый полезный видимый текст, доступные ссылки и structured data, совпадающие с HTML. Специального AI-файла или schema не требуется.
- [Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers) — crawler controls применяются по конкретным User-Agent. `Google-Extended` не управляет обычной индексацией Google Search.
- [IndexNow protocol](https://www.indexnow.org/documentation) — key-файл и submit содержат только URL канонического host; уведомление не обещает индексацию.
- [Яндекс: robots.txt](https://yandex.ru/support/webmaster/en/controlling-robot/robots-txt) и [Sitemap](https://yandex.ru/support/webmaster/en/indexing-options/sitemap) — robots не является способом гарантированно удалить уже известный URL, sitemap остаётся рекомендацией роботу.
- [OpenAI crawlers](https://developers.openai.com/api/docs/bots) — `OAI-SearchBot`, `GPTBot` и `ChatGPT-User` имеют разные назначения и независимые robots controls.
- [Anthropic crawlers](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) — отдельно заявлены `ClaudeBot`, `Claude-User` и `Claude-SearchBot`.
- [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) — отдельно заявлены `PerplexityBot` и `Perplexity-User`; серверный счётчик опирается только на представившийся User-Agent и поэтому не доказывает личность клиента.

`robots.txt` разрешает публичный корпус и закрывает API, кабинет, admin, оплату и другие приватные маршруты одинаково для обычных и заявленных AI/search crawlers. Crawler cloaking, hidden text, keyword stuffing, фиктивные rating/review/FAQ и разметка, не совпадающая с видимым содержимым, запрещены.

## Действия владельца, требующие входа

Google Search Console:

1. Добавить Domain property `techrole.ru` и пройти DNS TXT verification.
2. Отправить `https://techrole.ru/sitemap.xml`.
3. Проверить `/`, `/answers`, `/professions/python-developer`, `/open-data-daily` через URL Inspection и Rich Results Test. Запрашивать переобход только после содержательного изменения.
4. Через 2–4 недели смотреть Pages, Performance и Core Web Vitals; не считать число «Crawled» гарантией показа или AI-цитаты.

Яндекс Вебмастер:

1. Добавить `https://techrole.ru`, подтвердить права DNS TXT или HTML-файлом.
2. Отправить `https://techrole.ru/sitemap.xml`, проверить robots и диагностику индексирования.
3. Проверить региональность только если появится реальное региональное предложение; не задавать фиктивный регион ради ранжирования.

Эти два checklist — единственные обязательные ручные шаги. Bing/IndexNow работает без входа после валидного key и успешной автоматической отправки; кабинет Bing можно подключить позже для отчётов.

## Проверка после релиза

1. Все HTML URL sitemap отвечают `200`, имеют один canonical, один `h1`, `lang=ru`, уникальные title/description и валидный JSON-LD.
2. `robots.txt` ссылается на sitemap; приватные URL не находятся в sitemap.
3. `/answers.json`, `/open-data.json`, `/ai-index.json`, `/research.json`, `/llms-full.txt` не превращают outage в пустые «актуальные» числа.
4. У каждой цитируемой цифры есть видимая расшифровка, источник, период, `n` или числитель/знаменатель, scope, tax status, дата и стабильная ссылка/fragment.
5. После deploy отправляется IndexNow и проверяется RSS. Рост оценивается по Search Console/Webmaster, качественным внешним ссылкам и измеримым переходам, а не по обещанию цитирования конкретной нейросетью.
