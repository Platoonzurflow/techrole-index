import { describe, expect, it } from "vitest";
import { buildOpenDataCsv, type OpenDataCsvItem } from "@/lib/open-data-csv";

const slice = {
  seniority: "junior" as const,
  vacancy_count: 30,
  salary_count: 24,
  salary_coverage: 0.8,
  sample_size: 20,
  median: 150000,
  average: 155000,
  p25: 130000,
  p75: 180000,
  confidence_level: "medium" as const,
};

describe("open-data CSV", () => {
  it("exports reproducible provenance fields and keeps zero distinct from missing", () => {
    const item: OpenDataCsvItem = {
      slug: "python-developer",
      name_ru: "Python-разработчик",
      period_days: 180,
      date_from: "2026-01-22",
      date_to: "2026-07-20",
      total_publications: 0,
      salary_currency: "RUB",
      salary_gross_status: "unknown",
      salary_min_sample: 20,
      salary_by_seniority: [{ ...slice, median: undefined }],
    };
    const csv = buildOpenDataCsv([item], "https://example.org");
    expect(csv).toContain("total_publications");
    expect(csv).toContain("python-developer,Python-разработчик,junior,180");
    expect(csv).toContain(",0,30,24,0.8,20,,155000,");
    expect(csv).toContain("https://example.org/professions/python-developer");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapes quotes and neutralizes spreadsheet formulas in text fields", () => {
    const item: OpenDataCsvItem = {
      slug: "safe-role",
      name_ru: '=HYPERLINK("https://bad.example","role")',
      period_days: 180,
      date_from: "2026-01-22",
      date_to: "2026-07-20",
      total_publications: 1,
      salary_currency: "RUB",
      salary_gross_status: "unknown",
      salary_min_sample: 20,
      salary_by_seniority: [slice],
    };
    const csv = buildOpenDataCsv([item], "https://example.org");
    expect(csv).toContain('"\'=HYPERLINK(""https://bad.example"",""role"")"');
  });
});
