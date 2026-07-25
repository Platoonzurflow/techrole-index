import { describe, expect, it } from "vitest";
import { getInsight, insights } from "@/lib/insights";

describe("editorial insights", () => {
  it("publishes thirteen unique, substantive articles", () => {
    expect(insights).toHaveLength(13);
    expect(new Set(insights.map((article) => article.slug)).size).toBe(13);
    for (const article of insights) {
      expect(article.sections.length).toBeGreaterThanOrEqual(4);
      expect(article.checklist.length).toBeGreaterThanOrEqual(4);
      expect(article.references.length).toBeGreaterThanOrEqual(3);
      expect(article.sections.flatMap((section) => section.paragraphs).join(" ").length).toBeGreaterThan(1200);
      expect(getInsight(article.slug)?.title).toBe(article.title);
    }
  });

  it("does not reuse titles or descriptions", () => {
    expect(new Set(insights.map((article) => article.title)).size).toBe(insights.length);
    expect(new Set(insights.map((article) => article.description)).size).toBe(insights.length);
  });

  it("keeps the first weekly research snapshot arithmetically consistent", () => {
    const article = getInsight("it-vacancy-publications-week-2026-07-18-2026-07-24");
    expect(article?.kind).toBe("research");
    expect(article?.publishedAt).toBe("2026-07-25");
    expect(article?.snapshot?.period).toBe("2026-07-18/2026-07-24");
    expect(article?.snapshot?.comparisonPeriod).toBe("2026-07-11/2026-07-17");
    expect(article?.snapshot?.table.rows.slice(0, 3).reduce((sum, row) => sum + Number(row.cells[1]), 0)).toBe(56);
    expect(article?.snapshot?.metrics.find((metric) => metric.id === "week-publications")?.value).toBe("71");
    expect(article?.snapshot?.metrics.find((metric) => metric.id === "week-complete-ranges")?.detail).toBe("66 из 71 публикации");
  });
});
