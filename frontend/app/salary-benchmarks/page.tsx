import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  latestSalaryBenchmarkDate,
  primarySalaryBenchmarkPoint,
  salaryBenchmarkCoverage,
  salaryBenchmarkLevelCoverage,
} from "@/lib/salary-benchmark-data";
import type { SalaryBenchmarkCatalogItem, SalaryBenchmarkPoint } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Зарплаты IT-специалистов — проверяемый датасет",
  description: "Открытые зарплатные ориентиры по 50 IT-профессиям с источниками, периодом, выборкой и налоговым статусом.",
  alternates: {
    canonical: "/salary-benchmarks",
    types: {
      "application/json": [{ url: "/salary-benchmarks.json", title: "Зарплатные ориентиры — JSON" }],
      "text/csv": [{ url: "/salary-benchmarks.csv", title: "Зарплатные ориентиры — CSV" }],
    },
  },
};

const coverageLabels = {
  direct: "прямой срез",
  related: "смежный срез",
  category: "только категория",
} as const;

function formatMoney(value?: number) {
  return value == null ? "—" : `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function formatPoint(point?: SalaryBenchmarkPoint) {
  if (!point) return "—";
  if (point.value != null) return formatMoney(point.value);
  if (point.lower != null || point.upper != null) {
    return `${formatMoney(point.lower)}–${formatMoney(point.upper)}`;
  }
  return "—";
}

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function SalaryBenchmarksPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let items: SalaryBenchmarkCatalogItem[] = [];
  let unavailable = false;
  try {
    items = await api<SalaryBenchmarkCatalogItem[]>("/salary-benchmarks");
  } catch {
    unavailable = true;
  }
  const coverage = salaryBenchmarkCoverage(items);
  const levelCoverage = salaryBenchmarkLevelCoverage(items);
  const dateModified = latestSalaryBenchmarkDate(items);
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${siteUrl}/salary-benchmarks#dataset`,
    name: "TechRole Index: ориентиры доходов IT-специалистов",
    description: "Отдельный справочный слой публичных исследований фактических доходов по 50 IT-профессиям.",
    url: `${siteUrl}/salary-benchmarks`,
    dateModified,
    inLanguage: "ru-RU",
    spatialCoverage: "Россия",
    variableMeasured: ["median", "average", "range", "p10", "p90", "sample_size", "salary_tax_status"],
    measurementTechnique: `${siteUrl}/methodology`,
    usageInfo: `${siteUrl}/sources`,
    isAccessibleForFree: true,
    includedInDataCatalog: `${siteUrl}/catalog.jsonld`,
    distribution: [
      { "@type": "DataDownload", contentUrl: `${siteUrl}/salary-benchmarks.json`, encodingFormat: "application/json" },
      { "@type": "DataDownload", contentUrl: `${siteUrl}/salary-benchmarks.csv`, encodingFormat: "text/csv" },
    ],
    additionalProperty: [
      { "@type": "PropertyValue", name: "profession_count", value: items.length },
      { "@type": "PropertyValue", name: "seniority_point_count", value: levelCoverage.points },
      { "@type": "PropertyValue", name: "current_market_claim", value: false },
    ],
  };

  return (
    <div className="shell py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(datasetSchema) }} />
      <p className="eyebrow">Открытый зарплатный слой</p>
      <h1 className="mt-3 max-w-5xl text-4xl font-bold">Зарплаты IT-специалистов с источниками и ограничениями</h1>
      <p className="mt-4 max-w-4xl text-lg leading-8 text-muted">Это ориентиры фактических доходов из публичных исследований, а не вилки вакансий. Для каждого числа сохранены период, источник, размер выборки, gross/net и точность соответствия профессии.</p>

      {unavailable ? (
        <div className="panel mt-8 p-8 text-muted">Датасет временно недоступен. Зарплатные значения на страницах профессий не изменены.</div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="panel p-5"><p className="text-sm text-muted">Профессий</p><p className="mt-2 text-3xl font-semibold">{items.length}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Junior / Middle / Senior</p><p className="mt-2 text-3xl font-semibold">{levelCoverage.points} из {items.length * 3}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Прямой срез</p><p className="mt-2 text-3xl font-semibold text-positive">{coverage.direct}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Смежный срез</p><p className="mt-2 text-3xl font-semibold">{coverage.related}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Только категория</p><p className="mt-2 text-3xl font-semibold">{coverage.category}</p></div>
          </section>

          <div className="mt-6 flex flex-wrap gap-3">
            <a className="button-primary" href="/salary-benchmarks.csv">Скачать CSV</a>
            <a className="button-secondary" href="/salary-benchmarks.json">Открыть JSON</a>
            <Link className="button-secondary" href="/methodology">Как читать данные</Link>
          </div>

          <section className="panel mt-8 overflow-hidden">
            <div className="border-b border-line p-6">
              <h2 className="text-2xl font-semibold">Все профессии</h2>
              <p className="mt-2 text-sm text-muted">Основной ориентир по России. Для всех {levelCoverage.complete_roles} профессий заполнены Junior, Middle и Senior; дата последнего источника: {dateModified ?? "не указана"}.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line text-muted"><tr><th className="p-4">Профессия</th><th className="p-4">Покрытие</th><th className="p-4">Ориентир</th><th className="p-4">Источник и статус</th></tr></thead>
                <tbody>
                  {items.map((item) => {
                    const point = primarySalaryBenchmarkPoint(item);
                    const source = item.benchmark.sources.find((candidate) => candidate.id === point?.source_id);
                    return (
                      <tr key={item.slug} className="border-b border-line/70 last:border-0">
                        <td className="p-4"><Link className="font-semibold hover:text-accent" href={`/professions/${item.slug}`}>{item.name_ru}</Link><p className="mt-1 text-muted">{item.name_en}</p></td>
                        <td className="p-4"><span className={`badge ${item.benchmark.coverage === "direct" ? "confidence-high" : item.benchmark.coverage === "related" ? "confidence-medium" : "confidence-low"}`}>{coverageLabels[item.benchmark.coverage]}</span></td>
                        <td className="p-4 font-mono text-base font-semibold">{formatPoint(point)}</td>
                        <td className="p-4 text-muted"><span>{source?.period ?? "период не указан"}</span><span> · {source?.tax_status === "net" ? "на руки" : source?.tax_status === "gross" ? "до налогов" : "gross/net неизвестен"}</span>{point?.sample_size ? <span> · n={point.sample_size.toLocaleString("ru-RU")}</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="mt-8 rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6">
        <h2 className="text-xl font-semibold">Не смешивать с вакансиями</h2>
        <p className="mt-3 max-w-4xl leading-7 text-muted">Слой не участвует в индексе и не заполняет пропуски официальных вилок вакансий. Смежный или категорийный срез остаётся явно подписанным, P10/P90 не выдаются за Junior/Senior, а неизвестный gross/net не угадывается.</p>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Доступность числа на сайте не означает единую открытую лицензию: условия дальнейшего использования определяются каждым первичным источником. Прямая ссылка и методология сохранены в JSON и CSV.</p>
      </section>
    </div>
  );
}
