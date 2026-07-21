import { describe, expect, it } from "vitest";
import { getInsight, insights } from "@/lib/insights";

describe("editorial insights", () => {
  it("publishes twelve unique, substantive articles", () => {
    expect(insights).toHaveLength(12);
    expect(new Set(insights.map((article) => article.slug)).size).toBe(12);
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
});
