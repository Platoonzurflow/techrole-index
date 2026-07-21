import { api } from "@/lib/api";
import {
  buildObservedPublicationCsv,
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";
import { conditionalResponse } from "@/lib/conditional-response";
import { observedPublicationDatasetPublishedDate } from "@/lib/observed-publication-croissant";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let dataset: ObservedPublicationMetricsExport;
  try {
    dataset = await api<ObservedPublicationMetricsExport>(
      "/open-data/publication-metrics-daily",
    );
  } catch {
    return new Response("Observed publication data is temporarily unavailable.\n", {
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "60",
      },
    });
  }
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  const lastModified = summary.lastMaterializedAt
    ?? `${observedPublicationDatasetPublishedDate}T00:00:00Z`;
  return conditionalResponse(request, buildObservedPublicationCsv(dataset.records, siteUrl), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Disposition": "inline; filename=techrole-index-open-data-daily.csv",
      "Content-Language": "ru-RU",
      "Content-Type": "text/csv; charset=utf-8",
      "Link": `<${siteUrl}/open-data-daily.csv>; rel="canonical", <${siteUrl}/open-data-daily>; rel="describedby", <${siteUrl}/open-data-daily.json>; rel="describedby", <${siteUrl}/open-data-daily.croissant.json>; rel="describedby"; type="application/ld+json", <${siteUrl}/open-data-daily.csv-metadata.json>; rel="describedby"; type="application/csvm+json", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "index, follow",
    },
  }, lastModified);
}
