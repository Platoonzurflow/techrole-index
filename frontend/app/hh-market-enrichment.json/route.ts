import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import type { OpenDataCatalogItem } from "@/lib/types";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let items: OpenDataCatalogItem[];
  try {
    items = await api<OpenDataCatalogItem[]>("/open-data/publications");
  } catch {
    return Response.json({ error: "hh_market_enrichment_unavailable", data_available: false }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
  const records = items.filter((item) => item.hh_market_data?.hh_enrichment).map((item) => ({
    profession_slug: item.slug,
    profession_name_ru: item.name_ru,
    category_slug: item.category_slug,
    date_from: item.hh_market_data?.date_from,
    date_to: item.hh_market_data?.date_to,
    total_publications: item.hh_market_data?.total_publications,
    last_ingested_at: item.hh_market_data?.last_ingested_at ?? null,
    enrichment: item.hh_market_data?.hh_enrichment,
  }));
  const lastModified = records.map((item) => item.last_ingested_at).filter(Boolean).sort().at(-1) ?? null;
  const body = JSON.stringify({
    schema_version: "1.0",
    name: "TechRole Index: агрегаты подробных карточек HH по профессиям",
    description: "Топ-5 работодателей и группа «Другие компании», навыки, языки, опыт, занятость, форматы и графики работы по классифицированным вакансиям.",
    canonical_url: `${siteUrl}/hh-market-enrichment.json`,
    dashboard_url: `${siteUrl}/companies`,
    csv_url: `${siteUrl}/hh-market-enrichment.csv`,
    source: { code: "hh_api", name: "HeadHunter API", url: "https://api.hh.ru/openapi/redoc" },
    current_market_claim: false,
    caveat: "Официальный ограниченный поисковый снимок, не полная база HH. Работодатели публикуются только как топ-5 по профессии и единая группа остальных компаний.",
    record_count: records.length,
    records,
  });
  return conditionalResponse(request, body, { headers: {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
    "Content-Language": "ru-RU",
    "Content-Type": "application/json; charset=utf-8",
    "Link": `<${siteUrl}/hh-market-enrichment.json>; rel="canonical", <${siteUrl}/hh-market-enrichment.csv>; rel="alternate"; type="text/csv", <${siteUrl}/companies>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
    "X-Robots-Tag": "index, follow, max-snippet:-1",
  } }, lastModified);
}
