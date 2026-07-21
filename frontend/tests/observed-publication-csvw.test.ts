import { describe, expect, it } from "vitest";
import {
  buildObservedPublicationCsvw,
  csvwContextUrl,
} from "@/lib/observed-publication-csvw";
import { observedPublicationCsvColumns } from "@/lib/observed-publication-data";
import type { ObservedPublicationMetric } from "@/lib/observed-publication-data";

const record: ObservedPublicationMetric = {
  metric_date: "2026-07-20",
  source_code: "trudvsem_open",
  source_name: "Работа России",
  profession_slug: "data-engineer",
  profession_name_ru: "Дата-инженер",
  seniority: "middle",
  region_code: "77",
  region_name_ru: "Москва",
  salary_tax_status: "unknown",
  normalized_currency: "RUB",
  publication_count: 7,
  salary_disclosed_count: 3,
  salary_coverage: 3 / 7,
  midpoint_sample_size: 3,
  salary_median: 200_000,
  salary_average: 210_000,
  salary_p25: 180_000,
  salary_p75: 230_000,
  lower_bound_median: 180_000,
  upper_bound_median: 220_000,
  confidence_level: "low",
  remote_count: 2,
  remote_share: 2 / 7,
  last_ingested_at: "2026-07-20T04:00:00Z",
  materialized_at: "2026-07-20T05:00:00Z",
  transform_version: "observed-publications-v1",
  current_market_claim: false,
};

describe("CSV on the Web metadata", () => {
  it("describes every actual CSV column with types and the composite key", () => {
    const metadata = buildObservedPublicationCsvw("https://techrole.example/", {
      salary_minimum_sample: 3,
      records: [record],
    });
    const columns = metadata.tableSchema.columns;

    expect(metadata["@context"][0]).toBe(csvwContextUrl);
    expect(metadata.url).toBe("https://techrole.example/open-data-daily.csv");
    expect(columns).toHaveLength(observedPublicationCsvColumns.length);
    expect(columns.map((column) => column.name)).toEqual(observedPublicationCsvColumns);
    expect(columns.find((column) => column.name === "metric_date")?.datatype).toBe("date");
    expect(columns.find((column) => column.name === "publication_count")?.datatype).toBe("integer");
    expect(columns.find((column) => column.name === "median")?.datatype).toBe("double");
    expect(columns.find((column) => column.name === "median")?.required).toBe(false);
    expect(columns.find((column) => column.name === "source_url")?.datatype).toBe("anyURI");
    expect(metadata.tableSchema.primaryKey).toHaveLength(7);
  });
});
