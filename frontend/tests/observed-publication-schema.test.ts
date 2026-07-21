import { describe, expect, it } from "vitest";
import { observedPublicationFields, type ObservedPublicationMetric } from "@/lib/observed-publication-data";
import {
  buildObservedPublicationDatasetSchema,
  observedPublicationMetricRequiredFields,
} from "@/lib/observed-publication-schema";

const record: ObservedPublicationMetric = {
  metric_date: "2026-07-20",
  source_code: "trudvsem_open",
  source_name: "Работа России",
  profession_slug: "data-engineer",
  profession_name_ru: "Дата-инженер",
  seniority: "middle",
  region_code: "all",
  region_name_ru: "Россия",
  salary_tax_status: "unknown",
  normalized_currency: "RUB",
  publication_count: 4,
  salary_disclosed_count: 3,
  salary_coverage: 0.75,
  midpoint_sample_size: 2,
  salary_median: null,
  salary_average: null,
  salary_p25: null,
  salary_p75: null,
  lower_bound_median: null,
  upper_bound_median: null,
  confidence_level: "insufficient",
  remote_count: 1,
  remote_share: 0.25,
  last_ingested_at: "2026-07-20T21:00:00Z",
  materialized_at: "2026-07-20T22:00:00Z",
  transform_version: "observed-publications-v1",
  current_market_claim: false,
};

describe("observed publication JSON Schema", () => {
  it("requires exactly every exported record field", () => {
    expect([...observedPublicationMetricRequiredFields].sort()).toEqual(Object.keys(record).sort());
    expect(observedPublicationFields.map((field) => field.name)).toEqual(
      observedPublicationMetricRequiredFields,
    );
  });

  it("publishes a strict Draft 2020-12 contract with a canonical id", () => {
    const schema = buildObservedPublicationDatasetSchema("https://techrole.example/");
    const rowSchema = schema.$defs.observedPublicationMetric;

    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe("https://techrole.example/open-data-daily.schema.json");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.schema_url).toEqual({
      const: "https://techrole.example/open-data-daily.schema.json",
    });
    expect(rowSchema.additionalProperties).toBe(false);
    expect([...rowSchema.required]).toEqual(observedPublicationMetricRequiredFields);
    expect(Object.keys(rowSchema.properties)).toEqual(observedPublicationMetricRequiredFields);
    expect(rowSchema.properties.current_market_claim).toEqual({ const: false });
  });

  it("locks the field dictionary to its documented order and descriptions", () => {
    const schema = buildObservedPublicationDatasetSchema("https://techrole.example");
    const fieldSchemas = schema.properties.fields.prefixItems;

    expect(fieldSchemas).toHaveLength(observedPublicationFields.length);
    expect(fieldSchemas.map((field) => field.properties.name.const)).toEqual(
      observedPublicationFields.map((field) => field.name),
    );
    expect(fieldSchemas.map((field) => field.properties.description.const)).toEqual(
      observedPublicationFields.map((field) => field.description),
    );
    expect(schema.properties.fields.items).toBe(false);
  });
});
