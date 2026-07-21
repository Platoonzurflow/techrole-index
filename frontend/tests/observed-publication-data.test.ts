import { describe, expect, it } from "vitest";
import {
  buildObservedPublicationCsv,
  observedPublicationFields,
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetric,
} from "@/lib/observed-publication-data";

const record: ObservedPublicationMetric = {
  metric_date: "2026-07-20",
  source_code: "trudvsem_open",
  source_name: "Работа России",
  profession_slug: "python-developer",
  profession_name_ru: "Python-разработчик",
  seniority: "junior",
  region_code: "msk",
  region_name_ru: "Москва",
  salary_tax_status: "unknown",
  normalized_currency: "RUB",
  publication_count: 3,
  salary_disclosed_count: 2,
  salary_coverage: 0.66667,
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
  last_ingested_at: "2026-07-20T21:00:00Z",
  materialized_at: "2026-07-20T22:00:00Z",
  transform_version: "observed-publications-v1",
  current_market_claim: false,
};

describe("observed publication CSV", () => {
  it("keeps null distinct from an observed zero", () => {
    const csv = buildObservedPublicationCsv([record], "https://techrole.example");
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    const cells = csv.trim().split("\r\n")[1].split(",");
    expect(cells[11]).toBe("0");
    expect(cells[12]).toBe("");
    expect(cells[21]).toBe("0");
    expect(cells[22]).toBe("0");
    expect(cells[26]).toBe("false");
    expect(csv).toContain("https://techrole.example/professions/python-developer");
  });

  it("neutralizes spreadsheet formulas in source strings", () => {
    const csv = buildObservedPublicationCsv(
      [{ ...record, profession_name_ru: "=HYPERLINK(\"bad\")" }],
      "https://techrole.example",
    );
    expect(csv).toContain("\"'=HYPERLINK(\"\"bad\"\")\"");

    const prefixed = buildObservedPublicationCsv(
      [{ ...record, profession_name_ru: "\t =WEBSERVICE(\"bad\")" }],
      "https://techrole.example",
    );
    expect(prefixed).toContain("\"'\t =WEBSERVICE(\"\"bad\"\")\"");
  });
});

describe("observed publication metadata", () => {
  it("documents every exported record field exactly once", () => {
    const documentedNames = observedPublicationFields.map((field) => field.name);
    expect([...documentedNames].sort()).toEqual(Object.keys(record).sort());
    expect(new Set(documentedNames).size).toBe(documentedNames.length);
  });

  it("summarizes unsorted rows without depending on their input order", () => {
    const summary = summarizeObservedPublicationMetrics([
      {
        ...record,
        metric_date: "2026-07-21",
        publication_count: 4,
        materialized_at: "2026-07-21T08:00:00Z",
        transform_version: "observed-publications-v2",
      },
      {
        ...record,
        metric_date: "2026-07-18",
        profession_slug: "data-engineer",
        publication_count: 2,
        materialized_at: "2026-07-20T23:00:00Z",
        transform_version: "observed-publications-v0",
      },
      record,
    ]);

    expect(summary).toEqual({
      dateFrom: "2026-07-18",
      dateTo: "2026-07-21",
      lastMaterializedAt: "2026-07-21T08:00:00Z",
      rowCount: 3,
      publicationCount: 9,
      professionCount: 2,
      transformVersions: [
        "observed-publications-v0",
        "observed-publications-v1",
        "observed-publications-v2",
      ],
    });
  });

  it("returns an explicit empty summary", () => {
    expect(summarizeObservedPublicationMetrics([])).toEqual({
      dateFrom: null,
      dateTo: null,
      lastMaterializedAt: null,
      rowCount: 0,
      publicationCount: 0,
      professionCount: 0,
      transformVersions: [],
    });
  });
});
