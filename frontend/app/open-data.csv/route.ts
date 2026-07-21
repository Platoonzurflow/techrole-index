import { safeApi } from "@/lib/api";
import { buildOpenDataCsv, type OpenDataCsvItem } from "@/lib/open-data-csv";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = await safeApi<OpenDataCsvItem[]>("/open-data/publications", []);
  return new Response(buildOpenDataCsv(items, siteUrl), {
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
  });
}
