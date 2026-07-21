import { describe, expect, it } from "vitest";
import { buildDcatCatalog, dcatConformanceUrl } from "@/lib/dcat";
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

describe("DCAT 3 catalog", () => {
  it("describes the dataset, direct distributions, service and provenance", () => {
    const catalog = buildDcatCatalog("https://techrole.example/", {
      salary_minimum_sample: 3,
      records: [record],
    });
    const dataset = catalog["dcat:dataset"];

    expect(dcatConformanceUrl).toBe("https://www.w3.org/TR/vocab-dcat-3/");
    expect(catalog["@type"]).toBe("dcat:Catalog");
    expect(catalog["@id"]).toBe("https://techrole.example/catalog.jsonld#catalog");
    expect(dataset["@type"]).toBe("dcat:Dataset");
    expect(dataset["dct:source"]["@id"]).toBe("https://trudvsem.ru/opendata/api");
    expect(dataset["dct:temporal"]?.["dcat:startDate"]["@value"]).toBe("2026-07-20");
    expect(dataset["dct:temporal"]?.["dcat:endDate"]["@value"]).toBe("2026-07-20");
    expect(dataset["dcat:distribution"]).toHaveLength(2);
    expect(dataset["dcat:distribution"].map((item) => item["dcat:downloadURL"]["@id"]))
      .toEqual([
        "https://techrole.example/open-data-daily.json",
        "https://techrole.example/open-data-daily.csv",
      ]);
    expect(catalog["dcat:service"]["dcat:servesDataset"]["@id"])
      .toBe("https://techrole.example/open-data-daily#dataset");
  });
});
