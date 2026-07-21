import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { russianFederalOpenDataTermsUrl } from "@/lib/data-licensing";
import {
  buildObservedPublicationCroissant,
  croissantMediaType,
  observedPublicationDatasetPublishedDate,
} from "@/lib/observed-publication-croissant";
import {
  observedPublicationFields,
  summarizeObservedPublicationMetrics,
  type ObservedPublicationMetricsExport,
} from "@/lib/observed-publication-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ежедневные публикации IT-вакансий — открытый датасет",
  description:
    "Документированный датасет TechRole Index: публикации IT-вакансий по UTC-дате создания, профессии, seniority, региону и налоговому статусу.",
  alternates: {
    canonical: "/open-data-daily",
    types: {
      "application/json": [
        { url: "/open-data-daily.json", title: "Ежедневные публикации IT-вакансий — JSON" },
      ],
      "text/csv": [
        { url: "/open-data-daily.csv", title: "Ежедневные публикации IT-вакансий — CSV" },
      ],
      "application/csvm+json": [
        { url: "/open-data-daily.csv-metadata.json", title: "CSVW metadata ежедневного датасета" },
      ],
      "application/schema+json": [
        { url: "/open-data-daily.schema.json", title: "JSON Schema ежедневного датасета" },
      ],
      [croissantMediaType]: [
        { url: "/open-data-daily.croissant.json", title: "Croissant 1.1 metadata" },
      ],
    },
  },
};

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function formatDate(value?: string | null) {
  if (!value) return "не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "не указано";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function OpenDataDailyPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let dataset: ObservedPublicationMetricsExport | null = null;

  try {
    dataset = await api<ObservedPublicationMetricsExport>(
      "/open-data/publication-metrics-daily",
    );
  } catch {
    dataset = null;
  }

  const summary = dataset
    ? summarizeObservedPublicationMetrics(dataset.records)
    : null;
  const temporalCoverage =
    summary?.dateFrom && summary.dateTo
      ? `${summary.dateFrom}/${summary.dateTo}`
      : undefined;
  const datasetId = `${siteUrl}/open-data-daily#dataset`;
  const croissant = dataset
    ? buildObservedPublicationCroissant({
        siteUrl,
        dataset,
        licenseUrl: russianFederalOpenDataTermsUrl,
      })
    : null;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/open-data-daily#webpage`,
        url: `${siteUrl}/open-data-daily`,
        name: "Ежедневные публикации IT-вакансий — открытый датасет",
        description:
          "Документация ежедневных срезов публикаций по UTC-дате создания записи.",
        inLanguage: "ru-RU",
        dateModified: summary?.lastMaterializedAt,
        mainEntity: { "@id": datasetId },
        breadcrumb: { "@id": `${siteUrl}/open-data-daily#breadcrumb` },
      },
      {
        "@type": "Dataset",
        "@id": datasetId,
        name: "TechRole Index: ежедневные публикации IT-вакансий",
        alternateName: "TechRole Index observed publication daily dataset",
        description:
          "Observed historical срезы классифицированных публикаций по UTC creation-date, профессии, seniority, региону и налоговому статусу зарплаты.",
        identifier: "techrole-index:observed-publications-daily:v1",
        url: `${siteUrl}/open-data-daily`,
        inLanguage: "ru-RU",
        isAccessibleForFree: true,
        creator: { "@id": `${siteUrl}/#organization` },
        publisher: { "@id": `${siteUrl}/#organization` },
        includedInDataCatalog: { "@id": `${siteUrl}/#catalog` },
        isBasedOn: "https://trudvsem.ru/opendata/api",
        license: russianFederalOpenDataTermsUrl,
        measurementTechnique: `${siteUrl}/methodology`,
        datePublished: observedPublicationDatasetPublishedDate,
        temporalCoverage,
        spatialCoverage: "Россия",
        dateModified: summary?.lastMaterializedAt,
        version: summary?.transformVersions.join(", ") || undefined,
        keywords: [
          "IT-вакансии",
          "рынок труда",
          "зарплаты в IT",
          "открытые данные",
          "исторические публикации вакансий",
        ],
        subjectOf: [
          {
            "@type": "CreativeWork",
            name: "JSON Schema ежедневного датасета",
            url: `${siteUrl}/open-data-daily.schema.json`,
            encodingFormat: "application/schema+json",
          },
          {
            "@type": "DigitalDocument",
            name: "CSV on the Web metadata",
            url: `${siteUrl}/open-data-daily.csv-metadata.json`,
            encodingFormat: "application/csvm+json",
          },
          {
            "@type": "DigitalDocument",
            name: "MLCommons Croissant 1.1 metadata",
            url: `${siteUrl}/open-data-daily.croissant.json`,
            encodingFormat: croissantMediaType,
          },
          {
            "@type": "DigitalDocument",
            name: "W3C DCAT 3 catalog",
            url: `${siteUrl}/catalog.jsonld`,
            encodingFormat: "application/ld+json",
          },
        ],
        variableMeasured: observedPublicationFields.map((field) => ({
          "@type": "PropertyValue",
          name: field.name,
          description: field.description,
        })),
        additionalProperty: [
          { "@type": "PropertyValue", name: "data_layer", value: "observed_historical" },
          { "@type": "PropertyValue", name: "metric_semantics", value: "classified_publications_by_creation_date" },
          { "@type": "PropertyValue", name: "current_market_claim", value: false },
          ...(dataset
            ? [{ "@type": "PropertyValue", name: "salary_minimum_sample", value: dataset.salary_minimum_sample }]
            : []),
          ...(summary
            ? [
                { "@type": "PropertyValue", name: "row_count", value: summary.rowCount },
                { "@type": "PropertyValue", name: "publication_count", value: summary.publicationCount },
                { "@type": "PropertyValue", name: "profession_count", value: summary.professionCount },
              ]
            : []),
        ],
        distribution: [
          {
            "@type": "DataDownload",
            contentUrl: `${siteUrl}/open-data-daily.json`,
            encodingFormat: "application/json",
          },
          {
            "@type": "DataDownload",
            contentUrl: `${siteUrl}/open-data-daily.csv`,
            encodingFormat: "text/csv",
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/open-data-daily#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Главная",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Ежедневные публикации IT-вакансий",
            item: `${siteUrl}/open-data-daily`,
          },
        ],
      },
    ],
  };

  return (
    <article className="shell py-12 lg:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
      {croissant ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(croissant) }}
        />
      ) : null}

      <p className="eyebrow">Observed historical open data</p>
      <h1 className="mt-3 max-w-5xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        Ежедневные публикации IT-вакансий
      </h1>
      <p className="mt-5 max-w-4xl text-lg leading-8 text-muted">
        Открытый набор TechRole Index группирует классифицированные публикации
        строго по <strong className="text-ink">UTC-дате создания записи</strong>,
        профессии, seniority, региону, налоговому статусу зарплаты и валюте.
        Это воспроизводимый исторический поток публикаций, а не live-снимок рынка.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/open-data-daily.json" className="button-primary">
          Скачать JSON
        </Link>
        <Link href="/open-data-daily.csv" className="button-secondary">
          Скачать CSV
        </Link>
        <Link href="/open-data-daily.csv-metadata.json" className="button-secondary">
          CSVW metadata
        </Link>
        <Link href="/open-data-daily.schema.json" className="button-secondary">
          JSON Schema
        </Link>
        <Link href="/open-data-daily.croissant.json" className="button-secondary">
          Croissant 1.1
        </Link>
        <Link href="/catalog.jsonld" className="button-secondary">
          DCAT 3
        </Link>
        <Link href="/datapackage.json" className="button-secondary">
          Data Package
        </Link>
        <Link href="/.well-known/linkset.json" className="button-secondary">
          RFC 9264 Linkset
        </Link>
      </div>

      {summary ? (
        <section className="mt-10" aria-labelledby="dataset-summary-title">
          <h2 id="dataset-summary-title" className="sr-only">
            Сводка набора данных
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="panel p-5">
              <dt className="text-sm font-semibold text-muted">Строк-срезов</dt>
              <dd
                className="mt-2 font-mono text-2xl font-extrabold"
                data-testid="dataset-row-count"
              >
                {summary.rowCount.toLocaleString("ru-RU")}
              </dd>
            </div>
            <div className="panel p-5">
              <dt className="text-sm font-semibold text-muted">Публикаций</dt>
              <dd
                className="mt-2 font-mono text-2xl font-extrabold"
                data-testid="dataset-publication-count"
              >
                {summary.publicationCount.toLocaleString("ru-RU")}
              </dd>
            </div>
            <div className="panel p-5">
              <dt className="text-sm font-semibold text-muted">Профессий</dt>
              <dd className="mt-2 font-mono text-2xl font-extrabold">
                {summary.professionCount.toLocaleString("ru-RU")}
              </dd>
            </div>
            <div className="panel p-5">
              <dt className="text-sm font-semibold text-muted">Период creation-date</dt>
              <dd className="mt-2 font-mono text-base font-bold">
                {formatDate(summary.dateFrom)} — {formatDate(summary.dateTo)}
              </dd>
            </div>
            <div className="panel p-5">
              <dt className="text-sm font-semibold text-muted">Версия transform</dt>
              <dd className="mt-2 break-words font-mono text-sm font-bold">
                {summary.transformVersions.length > 0
                  ? summary.transformVersions.join(", ")
                  : "не указана"}
              </dd>
            </div>
            <div className="panel p-5">
              <dt className="text-sm font-semibold text-muted">Материализовано</dt>
              <dd className="mt-2 font-mono text-sm font-bold">
                {formatDateTime(summary.lastMaterializedAt)} UTC
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <section
          className="panel mt-10 border-amber-400/35 p-6 sm:p-8"
          aria-live="polite"
          data-testid="dataset-unavailable"
        >
          <p className="eyebrow">Временно недоступно</p>
          <h2 className="mt-2 text-2xl font-extrabold">
            Сводка набора сейчас не загружена
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-muted">
            API данных не ответил. Документация, словарь полей и постоянные
            адреса форматов остаются доступны; числовые показатели не
            подставляются из кэша и не угадываются.
          </p>
        </section>
      )}

      <section className="panel mt-10 p-6 sm:p-8">
        <p className="eyebrow">Единица наблюдения</p>
        <h2 className="mt-2 text-2xl font-extrabold">Гранулярность одной строки</h2>
        <p className="mt-4 max-w-4xl leading-7 text-muted">
          Одна строка — это сочетание <code>metric_date × source × profession ×
          seniority × region × salary_tax_status × normalized_currency</code>.
          Значение <code>publication_count</code> показывает количество записей,
          созданных в эту UTC-дату и попавших в такой срез.
        </p>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3" aria-label="Ограничения набора">
        <article className="rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6">
          <h2 className="text-lg font-extrabold">Не число активных вакансий</h2>
          <p className="mt-3 leading-7 text-muted">
            <strong className="text-ink">Исторический поток публикаций не равен
            числу одновременно активных вакансий.</strong> Запись относится к
            дате её создания, даже если позже она оставалась открытой.
          </p>
        </article>
        <article className="rounded-2xl border border-line p-6">
          <h2 className="text-lg font-extrabold">Unknown остаётся unknown</h2>
          <p className="mt-3 leading-7 text-muted">
            Если источник не сообщает gross/net, налоговый статус хранится как
            <code>unknown</code>. Он не подменяется gross и не смешивается с
            явно определёнными группами.
          </p>
        </article>
        <article className="rounded-2xl border border-line p-6">
          <h2 className="text-lg font-extrabold">Null не равен нулю</h2>
          <p className="mt-3 leading-7 text-muted">
            <code>null</code> означает отсутствие публикуемого значения —
            например, когда выборка не прошла quality gate. Ноль означает
            измеренное нулевое значение и сохраняет другой смысл.
          </p>
        </article>
      </section>

      <section className="mt-10" aria-labelledby="field-dictionary-title">
        <p className="eyebrow">Data dictionary</p>
        <h2 id="field-dictionary-title" className="mt-2 text-3xl font-extrabold">
          Полный словарь полей
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted">
          Названия совпадают с ключами JSON. CSV представляет тот же публичный
          слой в плоском виде; пустая ячейка не должна интерпретироваться как ноль.
        </p>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          {observedPublicationFields.map((field) => (
            <div key={field.name} className="panel p-5">
              <dt>
                <code className="font-bold text-accent">{field.name}</code>
              </dt>
              <dd className="mt-2 text-sm leading-6 text-muted">
                {field.description}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel mt-10 p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold">Происхождение и цитирование</h2>
        <p className="mt-3 max-w-4xl leading-7 text-muted">
          При публикации числа укажите название набора, период creation-date,
          профессию и seniority, размер выборки, версию transform, дату
          материализации и исходного поставщика наблюдений.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/citation" className="button-primary">
            Как цитировать
          </Link>
          <Link href="/data-status" className="button-secondary">
            Provenance
          </Link>
          <Link href="/data-status.json" className="button-secondary">
            Provenance JSON
          </Link>
          <Link href="/methodology" className="button-secondary">
            Методология
          </Link>
          <Link href="/sources" className="button-secondary">
            Условия источников
          </Link>
          <a
            href="https://trudvsem.ru/opendata/api"
            className="button-secondary"
            rel="noreferrer"
          >
            API «Работы России» ↗
          </a>
        </div>
      </section>
    </article>
  );
}
