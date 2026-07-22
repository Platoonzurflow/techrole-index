import { api } from "@/lib/api";
import { conditionalResponse } from "@/lib/conditional-response";
import {
  latestSalaryBenchmarkDate,
  salaryBenchmarkCoverage,
  salaryBenchmarkLevelCoverage,
} from "@/lib/salary-benchmark-data";
import type { SalaryBenchmarkCatalogItem } from "@/lib/types";

export async function GET(request: Request) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let items: SalaryBenchmarkCatalogItem[];
  try {
    items = await api<SalaryBenchmarkCatalogItem[]>("/salary-benchmarks");
  } catch {
    return Response.json(
      { detail: "Salary benchmark dataset is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = JSON.stringify({
    schema_version: "1.0",
    id: `${siteUrl}/salary-benchmarks.json`,
    name: "TechRole Index: ориентиры доходов IT-специалистов",
    status: "public_reference",
    current_market_claim: false,
    date_modified: latestSalaryBenchmarkDate(items),
    profession_count: items.length,
    coverage: salaryBenchmarkCoverage(items),
    seniority_coverage: salaryBenchmarkLevelCoverage(items),
    currency: "RUB",
    salary_tax_statuses: ["net", "unknown"],
    license_status: "source_specific_terms_apply",
    usage_info_url: `${siteUrl}/sources`,
    methodology_url: `${siteUrl}/methodology`,
    provenance_url: `${siteUrl}/data-status.json`,
    citation_url: `${siteUrl}/citation`,
    csv_url: `${siteUrl}/salary-benchmarks.csv`,
    dataset: items,
  });
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/json; charset=utf-8",
      "Link": `<${siteUrl}/salary-benchmarks>; rel="canonical", <${siteUrl}/methodology>; rel="describedby", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, latestSalaryBenchmarkDate(items));
}
