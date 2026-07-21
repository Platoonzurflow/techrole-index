import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import { russianFederalOpenDataTermsUrl } from "@/lib/data-licensing";
import {
  buildObservedPublicationCroissant,
  croissantMediaType,
} from "@/lib/observed-publication-croissant";
import {
  buildObservedPublicationCsv,
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";

export async function GET(request: Request) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
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

  const csvBody = buildObservedPublicationCsv(dataset.records, siteUrl);
  const metadata = buildObservedPublicationCroissant({
    siteUrl,
    dataset,
    csvBody,
    licenseUrl: russianFederalOpenDataTermsUrl,
  });
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  const body = JSON.stringify(metadata);

  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Disposition": "inline; filename=techrole-index-open-data-daily.croissant.json",
      "Content-Language": "ru-RU",
      "Content-Type": `${croissantMediaType}; charset=utf-8`,
      "Link": `<${siteUrl}/open-data-daily.croissant.json>; rel="canonical", <${siteUrl}/open-data-daily>; rel="describedby", <${siteUrl}/open-data-daily.csv>; rel="alternate"; type="text/csv", <${siteUrl}/open-data-daily.json>; rel="alternate"; type="application/json", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, summary.lastMaterializedAt);
}
