import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import { buildOpenDataCsv, type OpenDataCsvItem } from "@/lib/open-data-csv";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let items: OpenDataCsvItem[];
  try {
    items = await api<OpenDataCsvItem[]>("/open-data/publications");
  } catch {
    return new Response("open data unavailable\n", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
  const lastModified = items
    .map((item) => item.last_ingested_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return conditionalResponse(request, buildOpenDataCsv(items, siteUrl), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Disposition": "inline; filename=techrole-index-open-data.csv",
      "Content-Language": "ru-RU",
      "Content-Type": "text/csv; charset=utf-8",
      "Link": `<${siteUrl}/open-data.json>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "index, follow",
    },
  }, lastModified);
}
