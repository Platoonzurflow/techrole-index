import { describe, expect, it } from "vitest";
import {
  buildObservedPublicationCroissant,
  croissantConformanceUrl,
} from "@/lib/observed-publication-croissant";
import {
  buildObservedPublicationCsv,
  observedPublicationCsvColumns,
  type ObservedPublicationMetric,
} from "@/lib/observed-publication-data";

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

describe("Croissant metadata", () => {
  it("describes the live CSV using the Croissant 1.1 contract", () => {
    const csvBody = buildObservedPublicationCsv([record], "https://techrole.example");
    const metadata = buildObservedPublicationCroissant({
      siteUrl: "https://techrole.example/",
      dataset: { salary_minimum_sample: 3, records: [record] },
      csvBody,
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });

    expect(metadata["@type"]).toBe("sc:Dataset");
    expect(metadata["dct:conformsTo"]).toBe(croissantConformanceUrl);
    expect(metadata.license).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(metadata.url).toBe("https://techrole.example/open-data-daily");
    expect(metadata.isLiveDataset).toBe(true);
    expect(metadata.temporalCoverage).toBe("2026-07-20/2026-07-20");
    expect(metadata.description).toContain("not the number of simultaneously active vacancies");
    expect(metadata.distribution[0]).not.toHaveProperty("sha256");
    expect(metadata.distribution[0].contentSize).toBe(
      `${new TextEncoder().encode(csvBody).byteLength} B`,
    );
  });

  it("maps every actual CSV column to exactly one typed field", () => {
    const csvBody = buildObservedPublicationCsv([record], "https://techrole.example");
    const metadata = buildObservedPublicationCroissant({
      siteUrl: "https://techrole.example",
      dataset: { salary_minimum_sample: 3, records: [record] },
      csvBody,
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });
    const fields = metadata.recordSet[0].field;

    expect(fields).toHaveLength(observedPublicationCsvColumns.length);
    expect(new Set(fields.map((field) => field.name)).size).toBe(fields.length);
    expect(fields.map((field) => field.name)).toEqual(observedPublicationCsvColumns);
    expect(fields.every((field) => field.description)).toBe(true);
    expect(fields.find((field) => field.name === "metric_date")?.dataType).toBe("sc:Date");
    expect(fields.find((field) => field.name === "publication_count")?.dataType).toBe("sc:Integer");
    expect(fields.find((field) => field.name === "median")?.dataType).toBe("sc:Float");
    expect(fields.find((field) => field.name === "current_market_claim")?.dataType).toBe("sc:Boolean");
    expect(fields.find((field) => field.name === "source_url")?.dataType).toBe("sc:URL");
  });
});
