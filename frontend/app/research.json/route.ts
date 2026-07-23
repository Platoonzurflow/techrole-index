import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import { summarizeOpenData, type ResearchOpenDataItem } from "@/lib/research";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let items: ResearchOpenDataItem[];
  try {
    items = await api<ResearchOpenDataItem[]>("/open-data/publications");
  } catch {
    return Response.json(
      { error: "research_data_unavailable", data_available: false },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  const summary = summarizeOpenData(items);
  const body = JSON.stringify({
    schema_version: "1.0",
    type: "Report",
    name: "IT-профессии России: публикации вакансий за 180 дней",
    canonical_url: `${siteUrl}/research`,
    dataset_url: `${siteUrl}/open-data.json`,
    methodology_url: `${siteUrl}/methodology`,
    citation_url: `${siteUrl}/citation`,
    interpretation: "Публикации по дате создания записи, не число одновременно активных вакансий.",
    summary: {
      total_publications: summary.totalPublications,
      represented_professions: summary.representedProfessions,
      zero_result_professions: summary.zeroResultProfessions,
      salary_ready_professions: summary.salaryReadyProfessions,
      date_from: summary.dateFrom ?? null,
      date_to: summary.dateTo ?? null,
      last_modified: summary.lastModified ?? null,
    },
    top_professions: summary.top.map((item, index) => ({
      rank: index + 1,
      slug: item.slug,
      name: item.name_ru,
      publications: item.total_publications,
      canonical_url: `${siteUrl}/professions/${item.slug}`,
    })),
  });
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/json; charset=utf-8",
      "Link": `<${siteUrl}/research>; rel="canonical", <${siteUrl}/methodology>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, summary.lastModified);
}
