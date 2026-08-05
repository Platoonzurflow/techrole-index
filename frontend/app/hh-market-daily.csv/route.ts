import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import {
  buildObservedPublicationCsv,
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
    return new Response("HH market daily data is temporarily unavailable.\n", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  return conditionalResponse(request, buildObservedPublicationCsv(dataset.records, siteUrl), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Disposition": "inline; filename=techrole-index-hh-market-daily.csv",
      "Content-Language": "ru-RU",
      "Content-Type": "text/csv; charset=utf-8",
      "Link": `<${siteUrl}/hh-market-daily.csv>; rel="canonical", <${siteUrl}/hh-market-daily.json>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "index, follow",
    },
  }, summary.lastMaterializedAt);
}
