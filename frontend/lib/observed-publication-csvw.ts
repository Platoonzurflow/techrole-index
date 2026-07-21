import { russianFederalOpenDataTermsUrl } from "@/lib/data-licensing";
import {
  observedPublicationCsvColumnMetadata,
  type ObservedPublicationCsvColumnKind,
} from "@/lib/observed-publication-csv-columns";
import {
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";

export const csvwContextUrl = "http://www.w3.org/ns/csvw";
export const csvwConformanceUrl = "https://www.w3.org/TR/tabular-metadata/";
export const csvwMediaType = "application/csvm+json";

const primaryKey = [
  "metric_date",
  "source_code",
  "profession_slug",
  "seniority",
  "region_code",
  "salary_tax_status",
  "currency",
] as const;

function datatype(kind: ObservedPublicationCsvColumnKind) {
  if (kind === "dateTime") return "dateTime";
  if (kind === "decimal") return "double";
  if (kind === "url") return "anyURI";
  return kind;
}

export function buildObservedPublicationCsvw(
  siteUrl: string,
  dataset: ObservedPublicationMetricsExport,
) {
  const base = siteUrl.replace(/\/$/, "");
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  return {
    "@context": [csvwContextUrl, { "@language": "ru" }],
    url: `${base}/open-data-daily.csv`,
    "dc:title": "TechRole Index: ежедневные публикации IT-вакансий",
    "dc:description": "Исторические срезы официальных публикаций по UTC-дате создания, профессии, seniority, региону и налоговому статусу зарплаты.",
    "dc:publisher": {
      "schema:name": "TechRole Index",
      "schema:url": { "@id": base },
    },
    "dc:license": { "@id": russianFederalOpenDataTermsUrl },
    "dc:source": { "@id": "https://trudvsem.ru/opendata/api" },
    "dc:conformsTo": { "@id": csvwConformanceUrl },
    "dc:modified": summary.lastMaterializedAt
      ? { "@value": summary.lastMaterializedAt, "@type": "xsd:dateTime" }
      : undefined,
    dialect: {
      encoding: "utf-8",
      delimiter: ",",
      header: true,
      lineTerminators: ["\r\n", "\n"],
    },
    null: "",
    tableSchema: {
      columns: observedPublicationCsvColumnMetadata.map((column) => ({
        name: column.name,
        titles: column.name,
        "dc:description": column.description,
        datatype: datatype(column.kind),
        required: column.required,
      })),
      primaryKey,
    },
  } as const;
}
