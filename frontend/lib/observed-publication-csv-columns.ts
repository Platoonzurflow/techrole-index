import {
  observedPublicationCsvColumns,
  observedPublicationFields,
} from "@/lib/observed-publication-data";

export type ObservedPublicationCsvColumn =
  (typeof observedPublicationCsvColumns)[number];
export type ObservedPublicationCsvColumnKind =
  | "boolean"
  | "date"
  | "dateTime"
  | "decimal"
  | "integer"
  | "string"
  | "url";

const metricAliases = {
  complete_range_sample_size: "midpoint_sample_size",
  median: "salary_median",
  average: "salary_average",
  p25: "salary_p25",
  p75: "salary_p75",
  currency: "normalized_currency",
} as const satisfies Partial<Record<ObservedPublicationCsvColumn, string>>;

const extraDescriptions = {
  canonical_profession_url: "Canonical TechRole Index page for the classified profession.",
  source_url: "Official upstream open-data API used for the observations.",
  methodology_url: "Methodology and interpretation rules for this dataset.",
} as const satisfies Partial<Record<ObservedPublicationCsvColumn, string>>;

const integerColumns = new Set<ObservedPublicationCsvColumn>([
  "publication_count",
  "salary_disclosed_count",
  "complete_range_sample_size",
  "remote_count",
]);
const decimalColumns = new Set<ObservedPublicationCsvColumn>([
  "salary_coverage",
  "median",
  "average",
  "p25",
  "p75",
  "lower_bound_median",
  "upper_bound_median",
  "remote_share",
]);
const dateTimeColumns = new Set<ObservedPublicationCsvColumn>([
  "last_ingested_at",
  "materialized_at",
]);
const urlColumns = new Set<ObservedPublicationCsvColumn>([
  "canonical_profession_url",
  "source_url",
  "methodology_url",
]);
const nullableColumns = new Set<ObservedPublicationCsvColumn>([
  "median",
  "average",
  "p25",
  "p75",
  "lower_bound_median",
  "upper_bound_median",
]);

function kind(column: ObservedPublicationCsvColumn): ObservedPublicationCsvColumnKind {
  if (column === "metric_date") return "date";
  if (column === "current_market_claim") return "boolean";
  if (integerColumns.has(column)) return "integer";
  if (decimalColumns.has(column)) return "decimal";
  if (dateTimeColumns.has(column)) return "dateTime";
  if (urlColumns.has(column)) return "url";
  return "string";
}

function description(column: ObservedPublicationCsvColumn) {
  const metricName = metricAliases[column as keyof typeof metricAliases] ?? column;
  const metric = observedPublicationFields.find(
    (candidate) => candidate.name === metricName,
  );
  return metric?.description
    ?? extraDescriptions[column as keyof typeof extraDescriptions]
    ?? column;
}

export const observedPublicationCsvColumnMetadata =
  observedPublicationCsvColumns.map((name) => ({
    name,
    description: description(name),
    kind: kind(name),
    required: !nullableColumns.has(name),
  }));
