import { russianFederalOpenDataTermsUrl } from "@/lib/data-licensing";
import {
  croissantConformanceUrl,
  observedPublicationDatasetPublishedDate,
} from "@/lib/observed-publication-croissant";
import {
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";

export const dcatConformanceUrl = "https://www.w3.org/TR/vocab-dcat-3/";

const context = {
  dcat: "http://www.w3.org/ns/dcat#",
  dct: "http://purl.org/dc/terms/",
  foaf: "http://xmlns.com/foaf/0.1/",
  prov: "http://www.w3.org/ns/prov#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  vcard: "http://www.w3.org/2006/vcard/ns#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
} as const;

function resource(id: string) {
  return { "@id": id } as const;
}

export function buildDcatCatalog(
  siteUrl: string,
  dataset: ObservedPublicationMetricsExport,
) {
  const base = siteUrl.replace(/\/$/, "");
  const summary = summarizeObservedPublicationMetrics(dataset.records);
  const datasetId = `${base}/open-data-daily#dataset`;
  const publisherId = `${base}/#organization`;
  const modified = summary.lastMaterializedAt
    ?? `${observedPublicationDatasetPublishedDate}T00:00:00Z`;
  const publisher = {
    "@id": publisherId,
    "@type": "foaf:Agent",
    "foaf:name": "TechRole Index",
    "foaf:homepage": resource(base),
  } as const;

  return {
    "@context": context,
    "@id": `${base}/catalog.jsonld#catalog`,
    "@type": "dcat:Catalog",
    "dct:title": { "@value": "Каталог открытых данных TechRole Index", "@language": "ru" },
    "dct:description": {
      "@value": "Машиночитаемый каталог воспроизводимых исторических срезов публикаций IT-вакансий с прямыми JSON и CSV представлениями, происхождением и условиями использования.",
      "@language": "ru",
    },
    "dct:issued": {
      "@value": observedPublicationDatasetPublishedDate,
      "@type": "xsd:date",
    },
    "dct:modified": { "@value": modified, "@type": "xsd:dateTime" },
    "dct:publisher": publisher,
    "dct:language": resource("http://id.loc.gov/vocabulary/iso639-1/ru"),
    "dct:license": resource(russianFederalOpenDataTermsUrl),
    "dcat:landingPage": resource(`${base}/open-data-daily`),
    "dcat:dataset": {
      "@id": datasetId,
      "@type": "dcat:Dataset",
      "dct:title": {
        "@value": "TechRole Index: ежедневные публикации IT-вакансий",
        "@language": "ru",
      },
      "dct:description": {
        "@value": "Исторические срезы классифицированных официальных публикаций по UTC-дате создания, профессии, seniority, региону и налоговому статусу зарплаты. Набор измеряет поток публикаций, а не число одновременно активных вакансий.",
        "@language": "ru",
      },
      "dct:identifier": "techrole-index:observed-publications-daily:v1",
      "dct:issued": {
        "@value": observedPublicationDatasetPublishedDate,
        "@type": "xsd:date",
      },
      "dct:modified": { "@value": modified, "@type": "xsd:dateTime" },
      "dct:creator": resource(publisherId),
      "dct:publisher": resource(publisherId),
      "dct:license": resource(russianFederalOpenDataTermsUrl),
      "dct:source": resource("https://trudvsem.ru/opendata/api"),
      "dct:accrualPeriodicity": resource(
        "http://publications.europa.eu/resource/authority/frequency/DAILY",
      ),
      "dct:spatial": {
        "@type": "dct:Location",
        "rdfs:label": { "@value": "Россия", "@language": "ru" },
      },
      ...(summary.dateFrom && summary.dateTo
        ? {
            "dct:temporal": {
              "@type": "dct:PeriodOfTime",
              "dcat:startDate": { "@value": summary.dateFrom, "@type": "xsd:date" },
              "dcat:endDate": { "@value": summary.dateTo, "@type": "xsd:date" },
            },
          }
        : {}),
      "dcat:keyword": [
        { "@value": "IT-вакансии", "@language": "ru" },
        { "@value": "рынок труда", "@language": "ru" },
        { "@value": "открытые данные", "@language": "ru" },
      ],
      "dcat:landingPage": resource(`${base}/open-data-daily`),
      "dcat:contactPoint": {
        "@type": "vcard:Kind",
        "vcard:fn": "TechRole Index",
        "vcard:hasEmail": resource("mailto:sqldevelopermoscow@yandex.com"),
      },
      "dct:conformsTo": [
        resource(croissantConformanceUrl),
        resource(`${base}/open-data-daily.csv-metadata.json`),
        resource(`${base}/open-data-daily.schema.json`),
      ],
      "prov:wasDerivedFrom": resource("https://trudvsem.ru/opendata/api"),
      "dcat:version": "1.0.0",
      "dcat:distribution": [
        {
          "@id": `${base}/catalog.jsonld#daily-json`,
          "@type": "dcat:Distribution",
          "dct:title": { "@value": "JSON distribution", "@language": "en" },
          "dct:license": resource(russianFederalOpenDataTermsUrl),
          "dcat:downloadURL": resource(`${base}/open-data-daily.json`),
          "dcat:mediaType": resource(
            "https://www.iana.org/assignments/media-types/application/json",
          ),
        },
        {
          "@id": `${base}/catalog.jsonld#daily-csv`,
          "@type": "dcat:Distribution",
          "dct:title": { "@value": "CSV distribution", "@language": "en" },
          "dct:license": resource(russianFederalOpenDataTermsUrl),
          "dct:conformsTo": resource(`${base}/open-data-daily.csv-metadata.json`),
          "dcat:downloadURL": resource(`${base}/open-data-daily.csv`),
          "dcat:mediaType": resource(
            "https://www.iana.org/assignments/media-types/text/csv",
          ),
        },
      ],
    },
    "dcat:service": {
      "@id": `${base}/catalog.jsonld#daily-api`,
      "@type": "dcat:DataService",
      "dct:title": { "@value": "TechRole Index public data API", "@language": "en" },
      "dct:conformsTo": resource("https://spec.openapis.org/oas/latest.html"),
      "dcat:endpointURL": resource(
        `${base}/api/v1/open-data/publication-metrics-daily`,
      ),
      "dcat:endpointDescription": resource(`${base}/api/openapi.json`),
      "dcat:servesDataset": resource(datasetId),
    },
  } as const;
}
