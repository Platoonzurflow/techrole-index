import type { HhFacetCount, HhMarketEnrichmentSummary, OpenDataCatalogItem } from "@/lib/types";

export interface HhEnrichmentCsvRow {
  profession_slug: string;
  profession_name_ru: string;
  date_from: string;
  date_to: string;
  total_publications: number;
  enriched_vacancy_count: number;
  enrichment_coverage: number;
  facet: string;
  rank: number;
  item_id: string;
  item_name: string;
  vacancy_count: number;
  share: number;
  schema_version: string;
  source_code: "hh_api";
}

const facetFields: Array<[keyof HhMarketEnrichmentSummary, string]> = [
  ["employer_distribution", "employer_top_5_and_other"],
  ["top_skills", "key_skill"],
  ["languages", "language_and_level"],
  ["employment_types", "employment_type"],
  ["employment_forms", "employment_form"],
  ["work_formats", "work_format"],
  ["work_schedules", "work_schedule"],
  ["work_schedule_by_days", "work_schedule_by_days"],
  ["working_hours", "working_hours"],
  ["working_time_intervals", "working_time_interval"],
  ["working_time_modes", "working_time_mode"],
  ["professional_roles", "professional_role"],
  ["experience_levels", "experience_level"],
  ["education_levels", "education_level"],
  ["civil_law_contracts", "civil_law_contract"],
  ["inclusiveness_types", "inclusiveness_type"],
  ["driver_license_types", "driver_license_type"],
];

const countFields: Array<[keyof HhMarketEnrichmentSummary, string, string]> = [
  ["internship_count", "vacancy_flag", "internship"],
  ["night_shift_count", "vacancy_flag", "night_shifts"],
  ["temporary_count", "vacancy_flag", "temporary_work"],
  ["labor_contract_count", "vacancy_flag", "labor_contract"],
  ["cover_letter_required_count", "vacancy_flag", "cover_letter_required"],
  ["test_required_count", "vacancy_flag", "test_required"],
  ["accessible_workplace_count", "vacancy_flag", "accessible_workplace"],
  ["teen_candidate_count", "vacancy_flag", "teen_candidates"],
];

export function flattenHhEnrichment(items: OpenDataCatalogItem[]): HhEnrichmentCsvRow[] {
  const rows: HhEnrichmentCsvRow[] = [];
  for (const item of items) {
    const hh = item.hh_market_data;
    const enrichment = hh?.hh_enrichment;
    if (!hh || !enrichment) continue;
    const base = {
      profession_slug: item.slug,
      profession_name_ru: item.name_ru,
      date_from: hh.date_from,
      date_to: hh.date_to,
      total_publications: hh.total_publications,
      enriched_vacancy_count: enrichment.enriched_vacancy_count,
      enrichment_coverage: enrichment.enrichment_coverage,
      schema_version: enrichment.schema_version,
      source_code: "hh_api" as const,
    };
    for (const [field, facet] of facetFields) {
      const values = enrichment[field];
      if (!Array.isArray(values)) continue;
      (values as HhFacetCount[]).forEach((value, index) => rows.push({
        ...base,
        facet,
        rank: index + 1,
        item_id: value.id,
        item_name: value.name,
        vacancy_count: value.count,
        share: value.share,
      }));
    }
    for (const [field, facet, itemName] of countFields) {
      const value = enrichment[field];
      if (typeof value !== "number" || value <= 0) continue;
      rows.push({
        ...base,
        facet,
        rank: 1,
        item_id: itemName,
        item_name: itemName,
        vacancy_count: value,
        share: enrichment.enriched_vacancy_count
          ? Math.round((value / enrichment.enriched_vacancy_count) * 10_000) / 10_000
          : 0,
      });
    }
  }
  return rows;
}

function csvCell(value: string | number) {
  const normalized = String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

export function buildHhEnrichmentCsv(items: OpenDataCatalogItem[], siteUrl: string) {
  const fields: Array<keyof HhEnrichmentCsvRow> = [
    "profession_slug", "profession_name_ru", "date_from", "date_to",
    "total_publications", "enriched_vacancy_count", "enrichment_coverage",
    "facet", "rank", "item_id", "item_name", "vacancy_count", "share",
    "schema_version", "source_code",
  ];
  const rows = flattenHhEnrichment(items);
  return [
    `# TechRole Index HH vacancy enrichment; ${siteUrl}/companies; source=https://api.hh.ru/openapi/redoc`,
    fields.join(","),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(",")),
    "",
  ].join("\n");
}
