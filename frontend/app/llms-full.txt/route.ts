import { safeApi } from "@/lib/api";
import { insights } from "@/lib/insights";
import type { OfficialSalarySlice, ProfessionSummary } from "@/lib/types";

interface Source {
  code: string;
  name: string;
  enabled: boolean;
  terms_url?: string;
}

interface OpenDataItem {
  slug: string;
  period_days: number;
  date_from: string;
  date_to: string;
  total_publications: number;
  last_ingested_at?: string;
  salary_currency: string;
  salary_gross_status: "unknown";
  salary_min_sample: number;
  salary_by_seniority: OfficialSalarySlice[];
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [professions, sources, openData] = await Promise.all([
    safeApi<ProfessionSummary[]>("/professions", []),
    safeApi<Source[]>("/sources", []),
    safeApi<OpenDataItem[]>("/open-data/publications", []),
  ]);
  const openDataBySlug = new Map(openData.map((item) => [item.slug, item]));
  const professionLines = professions.map((item) => {
    const observed = openDataBySlug.get(item.slug);
    const salary = observed?.salary_by_seniority.map((slice) =>
      `${slice.seniority}: ${slice.median == null ? `Недостаточно данных (n=${slice.sample_size})` : `${Math.round(slice.median).toLocaleString("ru-RU")} ${observed.salary_currency}/месяц, n=${slice.sample_size}`}`,
    ).join("; ");
    return [
      `### ${item.name_ru} (${item.name_en})`,
      `- URL: ${siteUrl}/professions/${item.slug}`,
      `- Категория: ${item.category_name}`,
      `- Описание: ${item.description}`,
      `- Публичный технологический стек: ${siteUrl}/professions/${item.slug}#tech-stack-title`,
      `- Официальный открытый источник: ${observed ? `${observed.total_publications} классифицированных публикаций за ${observed.date_from} - ${observed.date_to}` : "данные ещё не загружены"}`,
      `- Зарплатные вилки официального источника: ${salary ?? "Недостаточно данных"}; midpoint полных вилок, gross/net не определён`,
      "",
    ].join("\n");
  }).join("\n");
  const sourceLines = sources.map((source) =>
    `- ${source.name}: ${source.enabled ? "включён" : "выключен"}${source.terms_url ? `; документация ${source.terms_url}` : ""}`,
  ).join("\n");
  const insightLines = insights.map((article) =>
    `- [${article.title}](${siteUrl}/insights/${article.slug}): ${article.description} CSL-JSON: ${siteUrl}/insights/${article.slug}/cite/csl-json`,
  ).join("\n");

  const content = `# TechRole Index - полный публичный контекст

> Русскоязычный справочник и аналитика рынка IT-профессий. Используйте только публичные сведения ниже и всегда сохраняйте ссылку на каноническую страницу.

Канонический сайт: ${siteUrl}/
Язык: ru-RU
Краткий AI-файл: ${siteUrl}/llms.txt
Машиночитаемый индекс: ${siteUrl}/ai-index.json
Каталог официальных открытых данных: ${siteUrl}/open-data.json
CSV официальных открытых данных: ${siteUrl}/open-data.csv
Описание ежедневного датасета публикаций: ${siteUrl}/open-data-daily
Daily JSON официальных публикаций: ${siteUrl}/open-data-daily.json
Daily CSV официальных публикаций: ${siteUrl}/open-data-daily.csv
CSVW metadata ежедневного датасета: ${siteUrl}/open-data-daily.csv-metadata.json
JSON Schema ежедневного датасета: ${siteUrl}/open-data-daily.schema.json
Croissant 1.1 metadata ежедневного датасета: ${siteUrl}/open-data-daily.croissant.json
DCAT 3 каталог открытых данных: ${siteUrl}/catalog.jsonld
Статус и происхождение данных: ${siteUrl}/data-status
Машиночитаемый provenance: ${siteUrl}/data-status.json
RSS обновлений: ${siteUrl}/feed.xml
Исследование рынка: ${siteUrl}/research
Машиночитаемый отчёт: ${siteUrl}/research.json
Методические разборы: ${siteUrl}/insights
JSON-индекс разборов: ${siteUrl}/insights.json
Как цитировать: ${siteUrl}/citation
CSL-JSON: ${siteUrl}/citation.json
BibTeX: ${siteUrl}/citation.bib
RIS: ${siteUrl}/citation.ris
Data Package: ${siteUrl}/datapackage.json
Методология: ${siteUrl}/methodology
Глоссарий: ${siteUrl}/glossary
Источники: ${siteUrl}/sources
Редакционные принципы: ${siteUrl}/about

## Правила корректного цитирования

1. Для цифры укажите профессию, дату обновления, период и размер выборки.
2. Не называйте среднее медианой и не смешивайте gross, net и неизвестный налоговый статус.
3. «Недостаточно данных» является результатом проверки качества, а не нулевым значением.
4. Тренд за 7 дней сравнивает два соседних семидневных окна, а не два дня.
5. TechRole Index 0-100 является сравнительным индикатором, а не обещанием зарплаты или трудоустройства.
6. Подготовленная дата метрики не является утверждением о live-состоянии рынка; проверяйте статус слоя в ${siteUrl}/data-status.

## Источники на текущей конфигурации

${sourceLines || "- Статус источников временно недоступен."}

## Методические разборы

${insightLines}

## Каталог публичных сущностей

${professionLines}

## Ответственность и исправления

Сообщить об ошибке: ${siteUrl}/support
Контакт: sqldevelopermoscow@yandex.com
`;
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
