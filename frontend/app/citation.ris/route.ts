import { safeApi } from "@/lib/api";
import { citationYear, latestDataDate, type CitableOpenDataItem } from "@/lib/citation";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = await safeApi<CitableOpenDataItem[]>("/open-data/publications", []);
  const date = latestDataDate(items);
  const body = [
    "TY  - DATA",
    "TI  - TechRole Index: аналитика IT-профессий и открытые данные о публикациях вакансий",
    "AU  - TechRole Index",
    `PY  - ${citationYear(date)}`,
    ...(date ? [`DA  - ${date.replaceAll("-", "/")}`] : []),
    `UR  - ${siteUrl}/open-data.json`,
    `N1  - Методология: ${siteUrl}/methodology; источники: ${siteUrl}/sources`,
    "LA  - ru-RU",
    "ER  - ",
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Type": "application/x-research-info-systems; charset=utf-8",
      "Content-Disposition": 'inline; filename="techrole-index.ris"',
    },
  });
}
