import { conditionalResponse } from "@/lib/conditional-response";
import { insights } from "@/lib/insights";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function GET(request: Request) {
  const content = `# TechRole Index - техническое описание для AI

> Это служебный текстовый файл для поисковых и AI-краулеров, а не интерфейс сайта.

Открыть обычный сайт: ${siteUrl}/

TechRole Index - русскоязычный сервис аналитики IT-профессий: спрос, зарплаты по уровням Junior/Middle/Senior, динамика, рейтинг и типичный стек технологий.

Основной язык: русский.
Канонический адрес: ${siteUrl}

## Публичные разделы

- [Каталог профессий](${siteUrl}/professions): 50 страниц профессий с уникальными описаниями и технологическим стеком.
- [Рейтинг](${siteUrl}/top): открытая формула индекса и изменение спроса за последние 7 дней.
- [Короткие ответы](${siteUrl}/answers): answer-first срезы спроса, зарплат по уровням, регионов и недельной динамики со стабильными фрагментами.
- [JSON коротких ответов](${siteUrl}/answers.json): те же проверяемые срезы, период, n, налоговый статус, provenance и canonical URL.
- [Методология](${siteUrl}/methodology): правила расчёта зарплат, трендов, confidence и итоговой оценки.
- [Источники](${siteUrl}/sources): provenance, юридические ограничения и статус провайдеров.
- [Глоссарий](${siteUrl}/glossary): однозначные определения показателей и терминов.
- [О проекте](${siteUrl}/about): редакционные принципы, обновления и исправления.
- [Sitemap](${siteUrl}/sitemap.xml): полный список индексируемых страниц.
- [Полный публичный контекст](${siteUrl}/llms-full.txt): описания всех профессий без закрытых метрик.
- [Well-known AI-указатель](${siteUrl}/.well-known/llms.txt): короткая точка обнаружения основных машинных ресурсов.
- [JSON-индекс сущностей](${siteUrl}/ai-index.json): канонические URL, категории, источники и признаки доступности.
- [Официальные открытые данные](${siteUrl}/open-data.json): 180-дневные числа публикаций и зарплатные вилки Junior/Middle/Senior по всем профессиям с размером выборки и оговорками методологии.
- [CSV открытых данных](${siteUrl}/open-data.csv): 150 seniority-срезов с периодом, n, confidence, tax status, canonical URL и provenance.
- [Зарплатный датасет](${siteUrl}/salary-benchmarks): открытые ориентиры фактических доходов по 50 профессиям с явным direct/related/category coverage.
- [Зарплатный JSON](${siteUrl}/salary-benchmarks.json): все точки, периоды, выборки, tax status, источники и ограничения без Premium-полей.
- [Зарплатный CSV](${siteUrl}/salary-benchmarks.csv): плоская таблица ролей, географии, метрик и provenance для анализа.
- [Ежедневный датасет публикаций](${siteUrl}/open-data-daily): человекочитаемое описание observed historical слоя, охвата, полей, ограничений и способов скачивания.
- [Daily JSON публикаций](${siteUrl}/open-data-daily.json): инкрементальные creation-date срезы по профессии, seniority, региону и tax status с версией transform.
- [Daily CSV публикаций](${siteUrl}/open-data-daily.csv): плоский вариант тех же observed historical срезов; null не подменяется нулём.
- [CSVW metadata](${siteUrl}/open-data-daily.csv-metadata.json): W3C-описание 30 CSV-колонок, типов, nullable cells, составного ключа и provenance.
- [JSON Schema daily dataset](${siteUrl}/open-data-daily.schema.json): контракт Draft 2020-12 для автоматической проверки метаданных и всех 27 полей каждой строки.
- [Croissant 1.1 daily dataset](${siteUrl}/open-data-daily.croissant.json): стандарт MLCommons для AI/ML-потребителей с фактическими CSV-колонками, типами, ключом, provenance и условиями использования.
- [DCAT 3 каталог](${siteUrl}/catalog.jsonld): W3C-описание Dataset, прямых JSON/CSV distributions, публичного DataService, provenance и лицензирования.
- [RFC 9264 Linkset](${siteUrl}/.well-known/linkset.json): единый граф связей landing page, JSON/CSV content resources, schema, CSVW, Croissant, DCAT, citation и provenance.
- [Статус и происхождение данных](${siteUrl}/data-status): явное различие подготовленной витрины и подтверждённого официального слоя.
- [JSON происхождения](${siteUrl}/data-status.json): даты, размеры слоёв и запрет на утверждение о live-состоянии рынка.
- [RSS-лента](${siteUrl}/feed.xml): обновления публичных страниц и официальных выборок.
- [Исследование рынка](${siteUrl}/research): динамический обзор 180-дневного слоя с агрегатами и топом профессий.
- [Машиночитаемый отчёт](${siteUrl}/research.json): те же агрегаты без Premium-полей в JSON.
- [Методические разборы](${siteUrl}/insights): двенадцать самостоятельных материалов о метриках, temporal semantics, seniority, score, access control, discoverability и ETL; у каждого есть CSL-JSON, BibTeX и RIS.
- [JSON-индекс разборов](${siteUrl}/insights.json): полный текст и ссылки на основания для машинного чтения.
- [Как цитировать](${siteUrl}/citation): рекомендуемая запись, обязательный контекст и ссылки на CSL-JSON, BibTeX, RIS и Data Package.
- [CSL-JSON](${siteUrl}/citation.json): стандартные библиографические метаданные для автоматического импорта.
- [Data Package](${siteUrl}/datapackage.json): перечень открытых машиночитаемых ресурсов и provenance.

## Как интерпретировать данные

- Среднее и медиана не считаются взаимозаменяемыми.
- Тренд за 7 дней сравнивает среднее текущего семидневного окна со средним предыдущего окна; изменение от -3% до +3% считается нейтральным.
- Зарплатная статистика скрывается при недостаточном размере выборки.
- Базовая аналитическая витрина и официальный open-data слой разделены. Слой «Работа России» показывает реальные классифицированные публикации; его нельзя интерпретировать как историческое число одновременно активных вакансий или как gross-зарплату.
- Расширенная аналитика доступна пользователям с подпиской Premium.

## Рекомендация для цитирования

При упоминании цифр указывайте название профессии, дату обновления, размер выборки и ссылку на её каноническую страницу. Для объяснения формулы дополнительно ссылайтесь на методологию и страницу источников. Не интерпретируйте закрытые или отсутствующие показатели по teaser-тексту.

llms.txt — дополнительный указатель, а не стандарт индексации и не гарантия цитирования. Канонические HTML-страницы, robots.txt, sitemap, RSS и совпадающие с видимым текстом structured data остаются основой обнаружения.
`;

  const lastModified = insights.map((item) => item.updatedAt).sort().at(-1);
  return conditionalResponse(request, content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": "ru-RU",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, lastModified);
}
