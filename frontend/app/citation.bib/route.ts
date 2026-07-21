import { safeApi } from "@/lib/api";
import { citationYear, latestDataDate, type CitableOpenDataItem } from "@/lib/citation";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = await safeApi<CitableOpenDataItem[]>("/open-data/publications", []);
  const date = latestDataDate(items);
  const body = `@misc{techrole_index_${citationYear(date)},
  author = {{TechRole Index}},
  title = {TechRole Index: аналитика IT-профессий и открытые данные о публикациях вакансий},
  year = {${citationYear(date)}},
  howpublished = {${siteUrl}/open-data.json},
  note = {${date ? `Обновлено ${date}. ` : ""}Методология: ${siteUrl}/methodology}
}
`;
  return new Response(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Type": "application/x-bibtex; charset=utf-8",
      "Content-Disposition": 'inline; filename="techrole-index.bib"',
    },
  });
}
