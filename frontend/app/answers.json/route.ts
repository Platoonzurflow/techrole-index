import { api } from "@/lib/api";
import { buildAnswerSummary, type AnswerOpenDataItem } from "@/lib/answers";
import { conditionalResponse } from "@/lib/conditional-response";
import type { ObservedPublicationMetricsExport } from "@/lib/observed-publication-data";

export async function GET(request: Request) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let items: AnswerOpenDataItem[];
  let daily: ObservedPublicationMetricsExport;
  try {
    [items, daily] = await Promise.all([
      api<AnswerOpenDataItem[]>("/open-data/publications"),
      api<ObservedPublicationMetricsExport>("/open-data/publication-metrics-daily"),
    ]);
  } catch {
    return Response.json(
      { error: "answer_data_unavailable", data_available: false },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  const summary = buildAnswerSummary(items, daily.records);
  const body = JSON.stringify({
    schema_version: "1.0",
    name: "TechRole Index: короткие ответы по рынку IT-профессий",
    canonical_url: `${siteUrl}/answers`,
    language: "ru-RU",
    current_market_claim: false,
    source_name: "Работа России",
    source_url: "https://trudvsem.ru/opendata/api",
    methodology_url: `${siteUrl}/methodology`,
    provenance_url: `${siteUrl}/data-status.json`,
    citation_url: `${siteUrl}/citation`,
    interpretation: "Показаны публикации по дате создания, а не число одновременно активных вакансий. Зарплаты — midpoint полных RUB-вилок; gross/net не определён.",
    ...summary,
  });
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/json; charset=utf-8",
      "Link": `<${siteUrl}/answers>; rel="canonical", <${siteUrl}/methodology>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, summary.date_modified);
}
