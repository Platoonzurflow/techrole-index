import { describe, expect, it } from "vitest";
import { buildHhEnrichmentCsv, flattenHhEnrichment } from "@/lib/hh-market-enrichment";
import type { HhMarketEnrichmentSummary, OpenDataCatalogItem } from "@/lib/types";

const enrichment: HhMarketEnrichmentSummary = {
  schema_version: "hh-details-v1",
  enriched_vacancy_count: 10,
  enrichment_coverage: 0.5,
  employer_vacancy_count: 10,
  distinct_employer_count: 7,
  employer_distribution: [
    { id: "1", name: "Компания, один", count: 4, share: 0.4 },
    { id: "other", name: "Другие компании", count: 6, share: 0.6 },
  ],
  top_skills: [{ id: "python", name: "Python", count: 8, share: 0.8 }],
  languages: [],
  employment_types: [],
  employment_forms: [],
  work_formats: [],
  work_schedules: [],
  work_schedule_by_days: [],
  working_hours: [],
  working_time_intervals: [],
  working_time_modes: [],
  professional_roles: [],
  experience_levels: [],
  education_levels: [],
  civil_law_contracts: [],
  inclusiveness_types: [],
  driver_license_types: [],
  internship_count: 1,
  night_shift_count: 0,
  temporary_count: 0,
  labor_contract_count: 0,
  cover_letter_required_count: 0,
  test_required_count: 0,
  accessible_workplace_count: 0,
  teen_candidate_count: 0,
};

const item = {
  slug: "python-developer",
  name_ru: "Python-разработчик",
  category_slug: "development",
  period_days: 180,
  date_from: "2026-01-01",
  date_to: "2026-08-05",
  total_publications: 1,
  salary_currency: "RUB",
  salary_gross_status: "unknown",
  salary_min_sample: 3,
  salary_by_seniority: [],
  hh_market_data: {
    period_days: 365,
    date_from: "2025-08-06",
    date_to: "2026-08-05",
    total_publications: 20,
    salary_disclosed_count: 5,
    salary_gross_count: 3,
    salary_net_count: 2,
    salary_tax_unknown_count: 0,
    remote_count: 8,
    salary_currency: "RUB",
    salary_min_sample: 3,
    salary_by_seniority: [],
    source_url: "https://api.hh.ru/openapi/redoc",
    methodology_note: "snapshot",
    hh_enrichment: enrichment,
  },
} satisfies OpenDataCatalogItem;

describe("HH market enrichment export", () => {
  it("exports top employers, other companies, skills and boolean facets", () => {
    const rows = flattenHhEnrichment([item]);
    expect(rows.filter((row) => row.facet === "employer_top_5_and_other")).toHaveLength(2);
    expect(rows.find((row) => row.item_id === "other")?.vacancy_count).toBe(6);
    expect(rows.find((row) => row.item_id === "python")?.vacancy_count).toBe(8);
    expect(rows.find((row) => row.item_id === "internship")?.share).toBe(0.1);
  });

  it("quotes employer names in CSV and includes source provenance", () => {
    const csv = buildHhEnrichmentCsv([item], "https://techrole.ru");
    expect(csv).toContain('"Компания, один"');
    expect(csv).toContain("https://api.hh.ru/openapi/redoc");
    expect(csv).toContain("hh-details-v1,hh_api");
  });
});
