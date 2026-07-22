import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import {
  buildSalaryBenchmarkCsv,
  latestSalaryBenchmarkDate,
} from "@/lib/salary-benchmark-data";
import type { SalaryBenchmarkCatalogItem } from "@/lib/types";

export async function GET(request: Request) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let items: SalaryBenchmarkCatalogItem[];
  try {
    items = await api<SalaryBenchmarkCatalogItem[]>("/salary-benchmarks");
  } catch {
    return new Response("Salary benchmark dataset is temporarily unavailable.\n", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return conditionalResponse(request, buildSalaryBenchmarkCsv(items, siteUrl), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Disposition": "inline; filename=techrole-index-salary-benchmarks.csv",
      "Content-Language": "ru-RU",
      "Content-Type": "text/csv; charset=utf-8",
      "Link": `<${siteUrl}/salary-benchmarks.json>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "index, follow",
    },
  }, latestSalaryBenchmarkDate(items));
}
