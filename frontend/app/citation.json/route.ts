import { safeApi } from "@/lib/api";
import { citationYear, latestDataDate, type CitableOpenDataItem } from "@/lib/citation";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = await safeApi<CitableOpenDataItem[]>("/open-data/publications", []);
  const date = latestDataDate(items);
  const year = citationYear(date);
  const dateParts = date?.split("-").map(Number) ?? [year];

  return Response.json({
    type: "dataset",
    id: `${siteUrl}/open-data.json`,
    title: "TechRole Index: аналитика IT-профессий и открытые данные о публикациях вакансий",
    author: [{ literal: "TechRole Index" }],
    publisher: "TechRole Index",
    issued: { "date-parts": [dateParts] },
    URL: `${siteUrl}/open-data.json`,
    language: "ru-RU",
    abstract: "Публичные описания 50 IT-профессий, классифицированные публикации и отдельные зарплатные срезы официального открытого источника.",
    note: `Методология: ${siteUrl}/methodology; источники: ${siteUrl}/sources`,
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/vnd.citationstyles.csl+json; charset=utf-8",
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
