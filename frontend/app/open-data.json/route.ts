import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import { observedPublicationPeriod } from "@/lib/market-period";
import type { OpenDataCatalogItem as OpenDataItem } from "@/lib/types";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let items: OpenDataItem[];
  try {
    items = await api<OpenDataItem[]>("/open-data/publications");
  } catch {
    return Response.json(
      { error: "open_data_unavailable", data_available: false },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  const lastModified = items
    .flatMap((item) => [item.last_ingested_at, item.hh_market_data?.last_ingested_at])
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const publisher = {
    "@type": "Organization",
    name: "TechRole Index",
    url: siteUrl,
  };
  const source = {
    "@type": "DataCatalog",
    name: "Общероссийская база вакансий «Работа России»",
    url: "https://trudvsem.ru/opendata",
    sameAs: "https://trudvsem.ru/opendata/api",
  };
  const hhSource = {
    "@type": "DataCatalog",
    name: "HeadHunter API",
    url: "https://api.hh.ru/openapi/redoc",
  };
  const body = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": `${siteUrl}/open-data.json`,
    name: "Официальные открытые данные о публикациях IT-вакансий",
    url: `${siteUrl}/open-data.json`,
    inLanguage: "ru-RU",
    description: "Проверяемые source-isolated ряды классифицированных публикаций IT-вакансий по 50 профессиям из открытого API «Работы России» и одобренного HH API.",
    dateModified: lastModified,
    publisher,
    isBasedOn: items.some((item) => item.hh_market_data) ? [source, hhSource] : source,
    measurementTechnique: `${siteUrl}/methodology`,
    usageInfo: `${siteUrl}/sources`,
    subjectOf: `${siteUrl}/llms-full.txt`,
    caveat: "Это публикации по дате создания записи, а не историческое число одновременно активных вакансий. Gross/net источником не определён.",
    dataset: items.map((item) => ({
      "@type": "Dataset",
      "@id": `${siteUrl}/open-data.json#${item.slug}`,
      name: `${item.name_ru}: публикации вакансий за ${item.period_days} дней`,
      description: `Ежедневное число классифицированных публикаций вакансий для профессии «${item.name_ru}» за ${item.period_days} дней.`,
      identifier: `techrole-index:${item.slug}:official-open-data:180d`,
      keywords: [item.name_ru, "IT-профессии", "зарплата", "вакансии", "рынок труда", "Работа России", ...(item.hh_market_data ? ["HeadHunter", "HH API"] : [])],
      url: `${siteUrl}/professions/${item.slug}`,
      mainEntityOfPage: `${siteUrl}/professions/${item.slug}`,
      temporalCoverage: `${item.date_from}/${item.date_to}`,
      spatialCoverage: "Россия",
      dateModified: item.last_ingested_at ?? undefined,
      creator: publisher,
      isBasedOn: item.hh_market_data ? [source, hhSource] : source,
      subjectOf: [
        { "@type": "CreativeWork", name: "Как цитировать TechRole Index", url: `${siteUrl}/citation` },
        { "@type": "CreativeWork", name: "Методология TechRole Index", url: `${siteUrl}/methodology` },
        { "@type": "CreativeWork", name: "Источники TechRole Index", url: `${siteUrl}/sources` },
      ],
      measurementTechnique: `${siteUrl}/methodology`,
      distribution: [
        {
          "@type": "DataDownload",
          contentUrl: `${siteUrl}/open-data.json`,
          encodingFormat: "application/ld+json",
        },
        {
          "@type": "DataDownload",
          contentUrl: `${siteUrl}/open-data.csv`,
          encodingFormat: "text/csv",
        },
        {
          "@type": "DataDownload",
          contentUrl: `${siteUrl}/open-data-daily.json`,
          encodingFormat: "application/json",
        },
        {
          "@type": "DataDownload",
          contentUrl: `${siteUrl}/open-data-daily.csv`,
          encodingFormat: "text/csv",
        },
      ],
      variableMeasured: [
        {
          "@type": "PropertyValue",
          name: "Классифицированные публикации вакансий",
          value: item.total_publications,
          unitText: "публикация",
        },
        ...item.salary_by_seniority.map((slice) => ({
          "@type": "PropertyValue",
          name: `Медианная зарплатная вилка: ${slice.seniority}`,
          value: slice.median ?? "Недостаточно данных",
          unitText: `${item.salary_currency} в месяц`,
          description: `Midpoint полных вилок, n=${slice.sample_size}; gross/net не определён; минимальная выборка ${item.salary_min_sample}.`,
        })),
        ...(item.hh_market_data ? [{
          "@type": "PropertyValue",
          name: "Классифицированные вакансии в снимке HH API",
          value: item.hh_market_data.total_publications,
          unitText: "вакансия",
          description: `${observedPublicationPeriod(item.hh_market_data).dateFrom} — ${observedPublicationPeriod(item.hh_market_data).dateTo}; наблюдаемые публикации поискового снимка, не полная историческая база.`,
        }, {
          "@type": "PropertyValue",
          name: "HH-вакансии с указанной gross-зарплатой",
          value: item.hh_market_data.salary_gross_count,
          unitText: "вакансия",
        }, ...(item.hh_market_data.hh_enrichment?.employer_distribution.map((employer) => ({
          "@type": "PropertyValue",
          name: `HH-вакансии работодателя: ${employer.name}`,
          value: employer.count,
          unitText: "вакансия",
          description: employer.id === "other" ? "Все работодатели вне публичного топ-5." : "Публичный топ-5 работодателей по числу классифицированных вакансий.",
        })) ?? []), ...(item.hh_market_data.hh_enrichment?.top_skills.map((skill) => ({
          "@type": "PropertyValue",
          name: `HH-вакансии с навыком: ${skill.name}`,
          value: skill.count,
          unitText: "вакансия",
        })) ?? []), ...item.hh_market_data.salary_by_seniority.map((slice) => ({
          "@type": "PropertyValue",
          name: `Медианная gross-вилка HH: ${slice.seniority}`,
          value: slice.median ?? "Недостаточно данных",
          unitText: `${item.hh_market_data?.salary_currency ?? "RUB"} в месяц до вычета налогов`,
          description: `Midpoint полных gross-вилок, n=${slice.sample_size}; минимальная выборка ${item.hh_market_data?.salary_min_sample ?? item.salary_min_sample}.`,
        }))] : []),
      ],
    })),
  });
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/ld+json; charset=utf-8",
      "Link": `<${siteUrl}/citation>; rel="cite-as", <${siteUrl}/citation.json>; rel="describedby"; type="application/vnd.citationstyles.csl+json"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, lastModified);
}
