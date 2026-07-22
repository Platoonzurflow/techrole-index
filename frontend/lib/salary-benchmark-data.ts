import type {
  SalaryBenchmarkCatalogItem,
  SalaryBenchmarkPoint,
  SalaryBenchmarkSummary,
  SalaryBenchmarkSource,
} from "@/lib/types";

export const salaryLevelOrder = ["junior", "middle", "senior"] as const;

const csvColumns = [
  "profession_slug",
  "profession_name_ru",
  "profession_name_en",
  "category_slug",
  "coverage",
  "scope",
  "label",
  "geography",
  "metric",
  "value",
  "lower",
  "upper",
  "p10",
  "p90",
  "seniority",
  "sample_size",
  "is_fallback",
  "note",
  "source_id",
  "source_name",
  "source_period",
  "source_published_at",
  "source_total_sample_size",
  "currency",
  "salary_tax_status",
  "income_type",
  "source_url",
  "methodology_url",
  "canonical_url",
] as const;

function csvCell(value: string | number | boolean | null | undefined) {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sourceForPoint(
  item: SalaryBenchmarkCatalogItem,
  point: SalaryBenchmarkPoint,
): SalaryBenchmarkSource | undefined {
  return item.benchmark.sources.find((source) => source.id === point.source_id);
}

export function salaryBenchmarkSourceForPoint(
  benchmark: SalaryBenchmarkSummary,
  point: SalaryBenchmarkPoint,
) {
  return benchmark.sources.find((source) => source.id === point.source_id);
}

export function salaryBenchmarkLevelPoints(benchmark: SalaryBenchmarkSummary) {
  return salaryLevelOrder.map((seniority) => {
    const candidates = benchmark.points.filter((point) => point.seniority === seniority);
    return candidates.find((point) => !point.is_fallback) ?? candidates[0];
  }).filter((point): point is SalaryBenchmarkPoint => Boolean(point));
}

export function salaryBenchmarkLevelCoverage(items: SalaryBenchmarkCatalogItem[]) {
  const completeRoles = items.filter(
    (item) => salaryBenchmarkLevelPoints(item.benchmark).length === salaryLevelOrder.length,
  ).length;
  const points = items.reduce(
    (total, item) => total + salaryBenchmarkLevelPoints(item.benchmark).length,
    0,
  );
  return { complete_roles: completeRoles, points };
}

export function buildSalaryBenchmarkCsv(
  items: SalaryBenchmarkCatalogItem[],
  siteUrl: string,
) {
  const base = siteUrl.replace(/\/$/, "");
  const rows = items.flatMap((item) => item.benchmark.points.map((point) => {
    const source = sourceForPoint(item, point);
    return [
      item.slug,
      item.name_ru,
      item.name_en,
      item.category_slug,
      item.benchmark.coverage,
      point.scope,
      point.label,
      point.geography,
      point.metric,
      point.value,
      point.lower,
      point.upper,
      point.p10,
      point.p90,
      point.seniority,
      point.sample_size,
      point.is_fallback,
      point.note,
      point.source_id,
      source?.name,
      source?.period,
      source?.published_at,
      source?.total_sample_size,
      source?.currency,
      source?.tax_status,
      source?.income_type,
      source?.url,
      source?.methodology_url,
      `${base}/professions/${item.slug}`,
    ];
  }));
  return `\uFEFF${[csvColumns, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}\r\n`;
}

export function salaryBenchmarkCoverage(items: SalaryBenchmarkCatalogItem[]) {
  return items.reduce(
    (counts, item) => {
      counts[item.benchmark.coverage] += 1;
      return counts;
    },
    { direct: 0, related: 0, category: 0 },
  );
}

export function latestSalaryBenchmarkDate(items: SalaryBenchmarkCatalogItem[]) {
  return items
    .flatMap((item) => item.benchmark.sources.map((source) => source.published_at))
    .sort()
    .at(-1);
}

export function primarySalaryBenchmarkPoint(item: SalaryBenchmarkCatalogItem) {
  const national = item.benchmark.points.filter((point) => point.geography === "russia");
  const scopeOrder: SalaryBenchmarkPoint["scope"][] = [
    "exact_role",
    "technology",
    "related_role",
    "category",
    "market_level",
  ];
  return scopeOrder
    .map((scope) => national.find((point) => point.scope === scope && point.seniority == null))
    .find((point): point is SalaryBenchmarkPoint => Boolean(point))
    ?? national[0]
    ?? item.benchmark.points[0];
}
