import { api } from "@/lib/api";
import {
  observedPublicationFields,
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";
import { conditionalResponse } from "@/lib/conditional-response";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let dataset: ObservedPublicationMetricsExport;
  try {
    dataset = await api<ObservedPublicationMetricsExport>(
      "/open-data/publication-metrics-daily",
    );
  } catch {
    return Response.json(
      { error: "observed_publication_data_unavailable", data_available: false },
      {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      },
    );
  }
  const records = dataset.records;
  const summary = summarizeObservedPublicationMetrics(records);

  const body = JSON.stringify({
    schema_version: "1.0",
    name: "TechRole Index: ежедневные срезы официальных публикаций",
    description: "Инкрементально материализованные срезы классифицированных публикаций по UTC creation-date, профессии, seniority, региону и налоговому статусу зарплаты.",
    canonical_url: `${siteUrl}/open-data-daily.json`,
    data_layer: "observed_historical",
    metric_semantics: "classified_publications_by_creation_date",
    current_market_claim: false,
    language: "ru-RU",
    source: {
      code: records[0]?.source_code ?? "trudvsem_open",
      name: records[0]?.source_name ?? "Работа России",
      url: "https://trudvsem.ru/opendata/api",
    },
    date_from: summary.dateFrom,
    date_to: summary.dateTo,
    date_modified: summary.lastMaterializedAt,
    transform_versions: summary.transformVersions,
    row_count: summary.rowCount,
    publication_count: summary.publicationCount,
    normalized_currency: "RUB",
    salary_tax_status_dimension: ["gross", "net", "unknown"],
    salary_minimum_sample: dataset.salary_minimum_sample,
    caveat: "Публикации по дате создания записи не равны одновременно активным вакансиям. Зарплатные значения остаются null ниже sample gate; unknown gross/net не считается gross.",
    methodology_url: `${siteUrl}/methodology`,
    provenance_url: `${siteUrl}/data-status.json`,
    citation_url: `${siteUrl}/citation`,
    csv_url: `${siteUrl}/open-data-daily.csv`,
    schema_url: `${siteUrl}/open-data-daily.schema.json`,
    fields: observedPublicationFields,
    records,
  });
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/json; charset=utf-8",
      "Link": `<${siteUrl}/open-data-daily.json>; rel="canonical", <${siteUrl}/open-data-daily>; rel="describedby", <${siteUrl}/open-data-daily.schema.json>; rel="describedby", <${siteUrl}/open-data-daily.croissant.json>; rel="describedby"; type="application/ld+json", <${siteUrl}/methodology>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, summary.lastMaterializedAt);
}
