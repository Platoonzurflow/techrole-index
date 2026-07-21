import {
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";
import {
  observedPublicationCsvColumnMetadata,
  type ObservedPublicationCsvColumnKind,
} from "@/lib/observed-publication-csv-columns";

export const croissantConformanceUrl = "http://mlcommons.org/croissant/1.1";
export const croissantMediaType =
  `application/ld+json; profile="${croissantConformanceUrl}"`;
export const observedPublicationDatasetPublishedDate = "2026-07-20";

const context = {
  "@language": "ru",
  "@vocab": "https://schema.org/",
  sc: "https://schema.org/",
  cr: "http://mlcommons.org/croissant/",
  rai: "http://mlcommons.org/croissant/RAI/",
  dct: "http://purl.org/dc/terms/",
  prov: "http://www.w3.org/ns/prov#",
  annotation: "cr:annotation",
  arrayShape: "cr:arrayShape",
  citeAs: "cr:citeAs",
  column: "cr:column",
  conformsTo: "dct:conformsTo",
  containedIn: "cr:containedIn",
  data: { "@id": "cr:data", "@type": "@json" },
  dataType: { "@id": "cr:dataType", "@type": "@vocab" },
  description: { "@container": "@language" },
  equivalentProperty: "cr:equivalentProperty",
  examples: { "@id": "cr:examples", "@type": "@json" },
  excludes: "cr:excludes",
  extract: "cr:extract",
  field: "cr:field",
  fileProperty: "cr:fileProperty",
  fileObject: "cr:fileObject",
  fileSet: "cr:fileSet",
  format: "cr:format",
  includes: "cr:includes",
  isArray: "cr:isArray",
  isLiveDataset: "cr:isLiveDataset",
  jsonPath: "cr:jsonPath",
  key: "cr:key",
  md5: "cr:md5",
  name: { "@container": "@language" },
  parentField: "cr:parentField",
  path: "cr:path",
  recordSet: "cr:recordSet",
  references: "cr:references",
  regex: "cr:regex",
  readLines: "cr:readLines",
  repeated: "cr:repeated",
  replace: "cr:replace",
  samplingRate: "cr:samplingRate",
  sdVersion: "cr:sdVersion",
  separator: "cr:separator",
  source: "cr:source",
  subField: "cr:subField",
  transform: "cr:transform",
  unArchive: "cr:unArchive",
  value: "cr:value",
} as const;

type CroissantDataType = "sc:Boolean" | "sc:Date" | "sc:DateTime" | "sc:Float"
  | "sc:Integer" | "sc:Text" | "sc:URL";

function dataType(kind: ObservedPublicationCsvColumnKind): CroissantDataType {
  if (kind === "boolean") return "sc:Boolean";
  if (kind === "date") return "sc:Date";
  if (kind === "dateTime") return "sc:DateTime";
  if (kind === "decimal") return "sc:Float";
  if (kind === "integer") return "sc:Integer";
  if (kind === "url") return "sc:URL";
  return "sc:Text";
}

export interface ObservedPublicationCroissantOptions {
  siteUrl: string;
  dataset: ObservedPublicationMetricsExport;
  csvBody?: string;
  licenseUrl: string;
}

export function buildObservedPublicationCroissant({
  siteUrl,
  dataset,
  csvBody,
  licenseUrl,
}: ObservedPublicationCroissantOptions) {
  const base = siteUrl.replace(/\/$/, "");
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  const recordSetId = "observed_publication_daily";
  const sourceFileId = "techrole-index-open-data-daily.csv";
  const organization = {
    "@type": "sc:Organization",
    name: "TechRole Index",
    url: base,
  };

  return {
    "@context": context,
    "@type": "sc:Dataset",
    "@id": `${base}/open-data-daily#dataset`,
    "dct:conformsTo": croissantConformanceUrl,
    name: "TechRole Index: daily observed IT vacancy publications",
    description: "Historical UTC creation-date slices of classified official IT vacancy publications by profession, seniority, region and salary tax status. The dataset measures publication flow, not the number of simultaneously active vacancies.",
    url: `${base}/open-data-daily`,
    license: licenseUrl,
    creator: organization,
    publisher: organization,
    datePublished: observedPublicationDatasetPublishedDate,
    dateCreated: observedPublicationDatasetPublishedDate,
    dateModified: summary.lastMaterializedAt ?? observedPublicationDatasetPublishedDate,
    version: "1.0.0",
    inLanguage: ["ru-RU", "en"],
    keywords: [
      "IT vacancies",
      "technology careers",
      "salary transparency",
      "Russia",
      "open data",
      "historical publication flow",
    ],
    sameAs: [
      `${base}/open-data-daily.json`,
      `${base}/open-data-daily.csv-metadata.json`,
      `${base}/open-data-daily.schema.json`,
      `${base}/datapackage.json`,
    ],
    citeAs: `TechRole Index (${observedPublicationDatasetPublishedDate.slice(0, 4)}). Daily observed IT vacancy publications. ${base}/open-data-daily`,
    isLiveDataset: true,
    temporalCoverage: summary.dateFrom && summary.dateTo
      ? `${summary.dateFrom}/${summary.dateTo}`
      : undefined,
    measurementTechnique: "Incremental materialization of classified official publication records by UTC creation date",
    "prov:wasDerivedFrom": {
      "@id": "https://trudvsem.ru/opendata/api",
      "@type": "prov:Entity",
      name: dataset.records[0]?.source_name ?? "Работа России",
    },
    distribution: [
      {
        "@type": "cr:FileObject",
        "@id": sourceFileId,
        name: sourceFileId,
        description: "UTF-8 CSV with one row per observed daily slice.",
        contentUrl: `${base}/open-data-daily.csv`,
        ...(csvBody === undefined
          ? {}
          : { contentSize: `${new TextEncoder().encode(csvBody).byteLength} B` }),
        encodingFormat: "text/csv",
        sameAs: `${base}/open-data-daily.json`,
      },
    ],
    recordSet: [
      {
        "@type": "cr:RecordSet",
        "@id": recordSetId,
        name: "Observed daily publication slices",
        description: "One record per UTC date, source, profession, seniority, region, salary tax status and currency slice.",
        key: [
          "metric_date",
          "source_code",
          "profession_slug",
          "seniority",
          "region_code",
          "salary_tax_status",
          "currency",
        ].map((column) => ({ "@id": `${recordSetId}/${column}` })),
        field: observedPublicationCsvColumnMetadata.map((column) => ({
          "@type": "cr:Field",
          "@id": `${recordSetId}/${column.name}`,
          name: column.name,
          description: column.description,
          dataType: dataType(column.kind),
          source: {
            fileObject: { "@id": sourceFileId },
            extract: { column: column.name },
          },
        })),
      },
    ],
  } as const;
}
