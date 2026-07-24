import { describe, expect, it } from "vitest";
import {
  buildSalaryBenchmarkCsv,
  latestSalaryBenchmarkDate,
  primarySalaryBenchmarkPoint,
  salaryBenchmarkCoverage,
  salaryBenchmarkLevelCoverage,
  salaryBenchmarkLevelPoints,
  salaryBenchmarkPointRepresentative,
} from "@/lib/salary-benchmark-data";
import type { SalaryBenchmarkCatalogItem } from "@/lib/types";

const item: SalaryBenchmarkCatalogItem = {
  slug: "data-engineer",
  name_ru: "Инженер по данным",
  name_en: "Data Engineer",
  category_slug: "data-ai",
  benchmark: {
    coverage: "direct",
    methodology_note: "Отдельный проверяемый ориентир.",
    points: [
      {
        source_id: "source-1",
        scope: "exact_role",
        label: "Инженер по данным",
        geography: "russia",
        metric: "median",
        value: 240000,
        p10: 100000,
        p90: 413000,
        sample_size: 120,
        is_fallback: false,
      },
    ],
    sources: [
      {
        id: "source-1",
        name: "Публичный отчёт",
        url: "https://example.org/report",
        methodology_url: "https://example.org/methodology",
        period: "I полугодие 2026",
        published_at: "2026-07-21",
        total_sample_size: 45226,
        currency: "RUB",
        tax_status: "net",
        income_type: "salary_plus_bonus",
        methodology_note: "Анонимный опрос.",
      },
    ],
  },
};

describe("salary benchmark dataset", () => {
  it("exports values together with provenance and tax status", () => {
    const csv = buildSalaryBenchmarkCsv([item], "https://techrole.example/");

    expect(csv).toContain("profession_slug,profession_name_ru");
    expect(csv).toContain("data-engineer,Инженер по данным,Data Engineer,data-ai,direct");
    expect(csv).toContain(",240000,,,100000,413000,,120,false,");
    expect(csv).toContain(",RUB,net,salary_plus_bonus,https://example.org/report,");
    expect(csv).toContain("https://techrole.example/professions/data-engineer");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("summarizes coverage and selects the exact national point", () => {
    expect(salaryBenchmarkCoverage([item])).toEqual({ direct: 1, related: 0, category: 0 });
    expect(latestSalaryBenchmarkDate([item])).toBe("2026-07-21");
    expect(primarySalaryBenchmarkPoint(item).value).toBe(240000);
  });

  it("counts complete grade coverage", () => {
    const withLevels: SalaryBenchmarkCatalogItem = {
      ...item,
      benchmark: {
        ...item.benchmark,
        points: [
          ...item.benchmark.points,
          ...(["junior", "middle", "senior"] as const).map((seniority) => ({
            source_id: "source-1",
            scope: "market_level" as const,
            label: "IT-рынок",
            geography: "russia" as const,
            metric: "median" as const,
            value: 100000,
            seniority,
            is_fallback: true,
          })),
        ],
      },
    };
    expect(salaryBenchmarkLevelCoverage([withLevels]))
      .toEqual({ complete_roles: 1, points: 3 });
  });

  it("uses one coherent grade family when role-specific points cross", () => {
    const benchmark = {
      ...item.benchmark,
      points: [
        {
          source_id: "role-source",
          scope: "technology" as const,
          label: ".NET · Middle",
          geography: "russia" as const,
          metric: "median" as const,
          value: 315000,
          seniority: "middle" as const,
          is_fallback: false,
        },
        {
          source_id: "role-source",
          scope: "technology" as const,
          label: ".NET · Senior",
          geography: "russia" as const,
          metric: "median" as const,
          value: 311000,
          seniority: "senior" as const,
          is_fallback: false,
        },
        ...([
          ["junior", 80000, 120000],
          ["middle", 170000, 230000],
          ["senior", 270000, 350000],
        ] as const).map(([seniority, lower, upper]) => ({
          source_id: "developer-market",
          scope: "market_level" as const,
          label: "Разработчики всех стеков",
          geography: "russia" as const,
          metric: "range" as const,
          lower,
          upper,
          seniority,
          is_fallback: true,
        })),
      ],
    };

    const selected = salaryBenchmarkLevelPoints(benchmark);
    expect(selected.map((point) => point.seniority)).toEqual(["junior", "middle", "senior"]);
    expect(selected.every((point) => point.source_id === "developer-market")).toBe(true);
    expect(selected.map(salaryBenchmarkPointRepresentative)).toEqual([100000, 200000, 310000]);
  });

  it("neutralizes spreadsheet formulas in text cells", () => {
    const unsafe = { ...item, name_ru: '=HYPERLINK("https://bad.example","role")' };
    expect(buildSalaryBenchmarkCsv([unsafe], "https://techrole.example"))
      .toContain('"\'=HYPERLINK(""https://bad.example"",""role"")"');
  });
});
