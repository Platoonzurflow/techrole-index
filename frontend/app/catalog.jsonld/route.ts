import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import { buildDcatCatalog, dcatConformanceUrl } from "@/lib/dcat";
import {
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";

export async function GET(request: Request) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    .replace(/\/$/, "");
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

  const body = JSON.stringify(buildDcatCatalog(siteUrl, dataset));
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Disposition": "inline; filename=techrole-index-catalog.jsonld",
      "Content-Language": "ru-RU",
      "Content-Type": "application/ld+json; charset=utf-8",
      "Link": `<${siteUrl}/catalog.jsonld>; rel="canonical", <${siteUrl}/open-data-daily>; rel="describedby", <${dcatConformanceUrl}>; rel="profile", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, summary.lastMaterializedAt);
}
