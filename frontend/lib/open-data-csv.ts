import type { OfficialSalarySlice } from "@/lib/types";

export interface OpenDataCsvItem {
  slug: string;
  name_ru: string;
  period_days: number;
  date_from: string;
  date_to: string;
  total_publications: number;
  last_ingested_at?: string;
  salary_currency: string;
  salary_gross_status: "unknown";
  salary_min_sample: number;
  salary_by_seniority: OfficialSalarySlice[];
}

const columns = [
  "profession_slug",
  "profession_name_ru",
  "seniority",
  "period_days",
  "date_from",
  "date_to",
  "total_publications",
  "vacancy_count",
  "salary_disclosed_count",
  "salary_coverage",
  "complete_range_sample_size",
  "median",
  "average",
  "p25",
  "p75",
  "confidence_level",
  "currency",
  "salary_tax_status",
  "minimum_sample",
  "last_ingested_at",
  "canonical_url",
  "source_url",
  "methodology_url",
] as const;

function csvCell(value: string | number | null | undefined) {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildOpenDataCsv(items: OpenDataCsvItem[], siteUrl: string) {
  const rows = items.flatMap((item) => item.salary_by_seniority.map((slice) => [
    item.slug,
    item.name_ru,
    slice.seniority,
    item.period_days,
    item.date_from,
    item.date_to,
    item.total_publications,
    slice.vacancy_count,
    slice.salary_count,
    slice.salary_coverage,
    slice.sample_size,
    slice.median,
    slice.average,
    slice.p25,
    slice.p75,
    slice.confidence_level,
    item.salary_currency,
    item.salary_gross_status,
    item.salary_min_sample,
    item.last_ingested_at,
    `${siteUrl}/professions/${item.slug}`,
    "https://trudvsem.ru/opendata/api",
    `${siteUrl}/methodology`,
  ]));
  return `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
