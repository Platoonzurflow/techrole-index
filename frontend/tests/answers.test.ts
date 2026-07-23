import { describe, expect, it } from "vitest";
import { buildAnswerSummary, type AnswerOpenDataItem } from "@/lib/answers";
import type { ObservedPublicationMetric } from "@/lib/observed-publication-data";

const slice = (seniority: "junior" | "middle" | "senior", median: number, sampleSize: number) => ({
  seniority,
  vacancy_count: sampleSize,
  salary_count: sampleSize,
  salary_coverage: 1,
  sample_size: sampleSize,
  median,
  average: median,
  p25: median - 10_000,
  p75: median + 10_000,
  lower_bound_median: median - 20_000,
  upper_bound_median: median + 20_000,
  confidence_level: "medium" as const,
});

const item = (slug: string, name: string, publications: number, sampleSize: number): AnswerOpenDataItem => ({
  slug,
  name_ru: name,
  date_from: "2026-07-01",
  date_to: "2026-07-14",
  total_publications: publications,
  last_ingested_at: "2026-07-14T05:00:00Z",
  salary_currency: "RUB",
  salary_gross_status: "unknown",
  salary_min_sample: 3,
  salary_by_seniority: [slice("junior", 100_000, sampleSize), slice("middle", 180_000, sampleSize), slice("senior", 250_000, sampleSize)],
});

const record = (metricDate: string, regionCode: string, regionName: string, count: number): ObservedPublicationMetric => ({
  metric_date: metricDate,
  source_code: "trudvsem_open",
  source_name: "Работа России",
  profession_slug: "backend",
  profession_name_ru: "Backend-разработчик",
  seniority: "middle",
  region_code: regionCode,
  region_name_ru: regionName,
  salary_tax_status: "unknown",
  normalized_currency: "RUB",
  publication_count: count,
  salary_disclosed_count: 0,
  salary_coverage: 0,
  midpoint_sample_size: 0,
  salary_median: null,
  salary_average: null,
  salary_p25: null,
  salary_p75: null,
  lower_bound_median: null,
  upper_bound_median: null,
  confidence_level: "insufficient",
  remote_count: 0,
  remote_share: 0,
  last_ingested_at: "2026-07-14T05:00:00Z",
  materialized_at: "2026-07-14T06:00:00Z",
  transform_version: "test-v1",
  current_market_claim: false,
});

describe("answer-first summary", () => {
  it("keeps ranking, sample strength, regions and adjacent seven-day windows deterministic", () => {
    const records = Array.from({ length: 14 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return record(`2026-07-${day}`, index % 2 ? "77" : "78", index % 2 ? "Москва" : "Санкт-Петербург", index < 7 ? 1 : 2);
    });
    const summary = buildAnswerSummary([
      item("frontend", "Frontend-разработчик", 8, 3),
      item("backend", "Backend-разработчик", 12, 9),
    ], records);

    expect(summary.top_professions.map((candidate) => candidate.slug)).toEqual(["backend", "frontend"]);
    expect(summary.salary_by_level[0].roles[0]).toMatchObject({ slug: "backend", sample_size: 9 });
    expect(summary.top_regions.map((region) => region.publications)).toEqual([11, 10]);
    expect(summary.publication_dynamics).toMatchObject({
      current_date_from: "2026-07-08",
      current_date_to: "2026-07-14",
      current_publications: 14,
      previous_date_from: "2026-07-01",
      previous_date_to: "2026-07-07",
      previous_publications: 7,
      change_percent: 100,
    });
  });
});
