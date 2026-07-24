import { describe, expect, it } from "vitest";

import { aggregatePublicationsByWeek, aggregateSalaryCoverageByWeek } from "@/components/Charts";


describe("publication chart aggregation", () => {
  it("turns sparse daily observations into readable weekly totals", () => {
    const points = Array.from({ length: 15 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      count: index === 1 || index === 8 || index === 14 ? 2 : 0,
    }));

    expect(aggregatePublicationsByWeek(points)).toEqual([
      { label: "2026-07-01 — 2026-07-07", count: 2 },
      { label: "2026-07-08 — 2026-07-14", count: 2 },
      { label: "2026-07-15 — 2026-07-15", count: 2 },
    ]);
  });

  it("explains how many publications can enter the salary median", () => {
    const publications = Array.from({ length: 8 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      count: index < 7 ? 2 : 4,
    }));
    const completeRanges = [
      { date: "2026-07-01", count: 1 },
      { date: "2026-07-04", count: 2 },
      { date: "2026-07-08", count: 1 },
    ];

    expect(aggregateSalaryCoverageByWeek(publications, completeRanges)).toEqual([
      {
        label: "2026-07-01 — 2026-07-07",
        publications: 14,
        completeRanges: 3,
        coveragePercent: 21.4,
      },
      {
        label: "2026-07-08 — 2026-07-08",
        publications: 4,
        completeRanges: 1,
        coveragePercent: 25,
      },
    ]);
  });
});
