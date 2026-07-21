import { describe, expect, it } from "vitest";
import { summarizeOpenData, type ResearchOpenDataItem } from "@/lib/research";

function item(slug: string, publications: number, salaryMedian?: number): ResearchOpenDataItem {
  return {
    slug,
    name_ru: slug,
    date_from: "2026-01-21",
    date_to: "2026-07-17",
    total_publications: publications,
    last_ingested_at: `2026-07-${publications > 0 ? "19" : "18"}T00:00:00Z`,
    salary_by_seniority: [{
      seniority: "middle",
      vacancy_count: publications,
      salary_count: publications,
      salary_coverage: 1,
      sample_size: publications,
      median: salaryMedian,
      average: salaryMedian,
      p25: salaryMedian,
      p75: salaryMedian,
      lower_bound_median: salaryMedian,
      upper_bound_median: salaryMedian,
      confidence_level: salaryMedian == null ? "insufficient" : "medium",
    }],
  };
}

describe("research summary", () => {
  it("aggregates only observed publications and keeps honest zeros", () => {
    const summary = summarizeOpenData([item("backend", 30, 200000), item("data", 20), item("rare", 0)]);
    expect(summary.totalPublications).toBe(50);
    expect(summary.representedProfessions).toBe(2);
    expect(summary.zeroResultProfessions).toBe(1);
    expect(summary.salaryReadyProfessions).toBe(1);
    expect(summary.top.map((entry) => entry.slug)).toEqual(["backend", "data"]);
    expect(summary.lastModified).toBe("2026-07-19T00:00:00Z");
  });
});
