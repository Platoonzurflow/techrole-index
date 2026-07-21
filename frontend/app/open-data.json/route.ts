import { safeApi } from "@/lib/api";
import type { OfficialSalarySlice } from "@/lib/types";

interface OpenDataItem {
  slug: string;
  name_ru: string;
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
  const items = await safeApi<OpenDataItem[]>("/open-data/publications", []);
  const lastModified = items
    .map((item) => item.last_ingested_at)
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
  return Response.json({
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": `${siteUrl}/open-data.json`,
    name: "Официальные открытые данные о публикациях IT-вакансий",
    url: `${siteUrl}/open-data.json`,
    inLanguage: "ru-RU",
    description: "Проверяемые 180-дневные ряды классифицированных публикаций IT-вакансий по 50 профессиям.",
    dateModified: lastModified,
    publisher,
    isBasedOn: source,
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
      keywords: [item.name_ru, "IT-профессии", "зарплата", "вакансии", "рынок труда", "Работа России"],
      url: `${siteUrl}/professions/${item.slug}`,
      mainEntityOfPage: `${siteUrl}/professions/${item.slug}`,
      temporalCoverage: `${item.date_from}/${item.date_to}`,
      spatialCoverage: "Россия",
      dateModified: item.last_ingested_at ?? undefined,
      creator: publisher,
      isBasedOn: source,
      citation: `TechRole Index. ${item.name_ru}: публикации и зарплатные вилки за ${item.period_days} дней. ${siteUrl}/professions/${item.slug}`,
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
      ],
    })),
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/ld+json; charset=utf-8",
      "Link": `<${siteUrl}/citation>; rel="cite-as", <${siteUrl}/citation.json>; rel="describedby"; type="application/vnd.citationstyles.csl+json"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
