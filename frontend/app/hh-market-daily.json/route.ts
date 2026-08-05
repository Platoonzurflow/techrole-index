import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import {
  observedPublicationFields,
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let dataset: ObservedPublicationMetricsExport;
  try {
    dataset = await api<ObservedPublicationMetricsExport>(
      "/open-data/publication-metrics-daily?source=hh_api",
    );
  } catch {
    return Response.json(
      { error: "hh_market_daily_unavailable", data_available: false },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  const body = JSON.stringify({
    schema_version: "1.0",
    name: "TechRole Index: ежедневные агрегаты HH API",
    description: "Source-isolated ежедневные срезы классифицированных вакансий официального HH API по профессии, seniority, региону и налоговому статусу зарплаты.",
    canonical_url: `${siteUrl}/hh-market-daily.json`,
    data_layer: "observed_historical_snapshot",
    metric_semantics: "classified_hh_vacancies_by_publication_date",
    current_market_claim: false,
    language: "ru-RU",
    source: { code: "hh_api", name: "HeadHunter API", url: "https://api.hh.ru/openapi/redoc" },
    date_from: summary.dateFrom,
    date_to: summary.dateTo,
    date_modified: summary.lastMaterializedAt,
    transform_versions: summary.transformVersions,
    row_count: summary.rowCount,
    publication_count: summary.publicationCount,
    normalized_currency: "RUB",
    salary_tax_status_dimension: ["gross", "net", "unknown"],
    salary_minimum_sample: dataset.salary_minimum_sample,
    caveat: "Официальный поисковый снимок, а не полная историческая база. Глубина одного поискового запроса ограничена 2 000 результатами. Gross, net и unknown не смешиваются; значения ниже sample gate остаются null.",
    methodology_url: `${siteUrl}/methodology`,
    provenance_url: `${siteUrl}/data-status.json`,
    citation_url: `${siteUrl}/citation`,
    csv_url: `${siteUrl}/hh-market-daily.csv`,
    fields: observedPublicationFields,
    records: dataset.records,
  });
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/json; charset=utf-8",
      "Link": `<${siteUrl}/hh-market-daily.json>; rel="canonical", <${siteUrl}/hh-market-daily.csv>; rel="alternate"; type="text/csv", <${siteUrl}/methodology>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, summary.lastMaterializedAt);
}
