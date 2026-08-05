import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import { buildHhEnrichmentCsv } from "@/lib/hh-market-enrichment";
import type { OpenDataCatalogItem } from "@/lib/types";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let items: OpenDataCatalogItem[];
  try {
    items = await api<OpenDataCatalogItem[]>("/open-data/publications");
  } catch {
    return new Response("HH market enrichment is temporarily unavailable.\n", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
  const lastModified = items.map((item) => item.hh_market_data?.last_ingested_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return conditionalResponse(request, buildHhEnrichmentCsv(items, siteUrl), { headers: {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
    "Content-Disposition": "inline; filename=techrole-index-hh-market-enrichment.csv",
    "Content-Language": "ru-RU",
    "Content-Type": "text/csv; charset=utf-8",
    "Link": `<${siteUrl}/hh-market-enrichment.csv>; rel="canonical", <${siteUrl}/hh-market-enrichment.json>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "index, follow",
  } }, lastModified);
}
