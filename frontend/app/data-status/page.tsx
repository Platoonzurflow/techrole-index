import type { Metadata } from "next";
import Link from "next/link";
import { safeApi } from "@/lib/api";
import type { DataProvenance, OfficialPublicationsLayer, PreparedAnalyticsLayer, SalaryBenchmarksLayer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Статус и происхождение данных",
  description: "Какие показатели TechRole Index подтверждены официальными публикациями, а какие относятся к подготовленной аналитической витрине.",
  alternates: { canonical: "/data-status" },
};

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat("ru-RU").format(new Date(value)) : "нет данных";
}

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function DataStatusPage() {
  const provenance = await safeApi<DataProvenance | null>("/data-provenance", null);
  const prepared = provenance?.layers.find((layer): layer is PreparedAnalyticsLayer => layer.id === "prepared_analytics");
  const official = provenance?.layers.find((layer): layer is OfficialPublicationsLayer => layer.id === "official_publications");
  const benchmarks = provenance?.layers.find((layer): layer is SalaryBenchmarksLayer => layer.id === "salary_benchmarks");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Статус и происхождение данных TechRole Index",
    url: `${siteUrl}/data-status`,
    inLanguage: "ru-RU",
    dateModified: provenance?.generated_at,
    about: [
      { "@type": "Dataset", name: prepared?.label, temporalCoverage: prepared?.last_metric_date, measurementTechnique: `${siteUrl}/methodology` },
      { "@type": "Dataset", name: official?.label, temporalCoverage: official ? `${official.window_date_from}/${official.window_date_to}` : undefined, isBasedOn: official?.source_url },
      { "@type": "Dataset", name: benchmarks?.label, temporalCoverage: benchmarks?.latest_period, isBasedOn: benchmarks?.source_urls },
    ],
  };

  return (
    <div className="shell py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <p className="eyebrow">Data provenance</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">Что подтверждено источником, а что подготовлено</h1>
      <p className="mt-5 max-w-4xl text-lg leading-8 text-muted">TechRole Index хранит три слоя раздельно. Они отвечают на разные вопросы, используют разный налоговый статус зарплаты и не должны подменять друг друга одной датой «обновлено».</p>

      {!provenance || !prepared || !official ? (
        <div className="panel mt-8 p-8 text-muted">Описание происхождения данных временно недоступно. Основные страницы и методология продолжают работать.</div>
      ) : (
        <section className="mt-10 grid gap-5 xl:grid-cols-3" aria-label="Слои данных">
          <article className="panel p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">Слой 1</p><span className="badge confidence-medium">подготовлено</span></div>
            <h2 className="mt-3 text-2xl font-semibold">{prepared.label}</h2>
            <p className="mt-4 leading-7 text-muted">{prepared.interpretation}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
              <div><dt className="text-muted">Последняя дата</dt><dd className="mt-1 font-mono font-semibold">{formatDate(prepared.last_metric_date)}</dd></div>
              <div><dt className="text-muted">Профессий</dt><dd className="mt-1 font-mono font-semibold">{prepared.profession_count}</dd></div>
              <div><dt className="text-muted">Зарплата</dt><dd className="mt-1 font-mono font-semibold">{prepared.salary_currency}</dd></div>
              <div><dt className="text-muted">Налоговый статус</dt><dd className="mt-1 font-mono font-semibold">gross</dd></div>
            </dl>
            <p className="mt-5 rounded-xl border border-amber-400/35 bg-amber-400/5 p-4 text-sm leading-6">Не является заявлением о текущем состоянии рынка. Дата означает дату подготовленной метрики.</p>
          </article>

          <article className="panel p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">Слой 2</p><span className="badge confidence-high">наблюдалось</span></div>
            <h2 className="mt-3 text-2xl font-semibold">{official.label}</h2>
            <p className="mt-4 leading-7 text-muted">{official.interpretation}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
              <div><dt className="text-muted">Классифицировано</dt><dd className="mt-1 font-mono font-semibold">{official.classified_publications.toLocaleString("ru-RU")}</dd></div>
              <div><dt className="text-muted">С зарплатой</dt><dd className="mt-1 font-mono font-semibold">{official.salary_disclosed_records.toLocaleString("ru-RU")}</dd></div>
              <div><dt className="text-muted">Наблюдалось с</dt><dd className="mt-1 font-mono font-semibold">{formatDate(official.observed_date_from)}</dd></div>
              <div><dt className="text-muted">Наблюдалось по</dt><dd className="mt-1 font-mono font-semibold">{formatDate(official.observed_date_to)}</dd></div>
              <div><dt className="text-muted">SQL-срезов</dt><dd className="mt-1 font-mono font-semibold">{official.materialized_slice_count.toLocaleString("ru-RU")}</dd></div>
              <div><dt className="text-muted">В SQL-витрине</dt><dd className="mt-1 font-mono font-semibold">{official.materialized_publications.toLocaleString("ru-RU")}</dd></div>
            </dl>
            <p className="mt-5 rounded-xl border border-line p-4 text-sm leading-6">Источник: {official.source_name}. Окно: {formatDate(official.window_date_from)} - {formatDate(official.window_date_to)}, полные UTC-календарные дни. Зарплата: {official.salary_currency}, gross/net не определён. Публикация не равна одновременно активной вакансии. Инкрементальная витрина: {official.materialized_transform_version ?? "ещё не построена"}, {formatDate(official.materialized_date_from)} - {formatDate(official.materialized_date_to)}.</p>
          </article>

          {benchmarks ? <article className="panel p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">Слой 3</p><span className="badge confidence-medium">публичный ориентир</span></div>
            <h2 className="mt-3 text-2xl font-semibold">{benchmarks.label}</h2>
            <p className="mt-4 leading-7 text-muted">{benchmarks.interpretation}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
              <div><dt className="text-muted">Профессий</dt><dd className="mt-1 font-mono font-semibold">{benchmarks.profession_count}</dd></div>
              <div><dt className="text-muted">Последний срез</dt><dd className="mt-1 font-mono font-semibold">{benchmarks.latest_period}</dd></div>
              <div><dt className="text-muted">Прямой срез</dt><dd className="mt-1 font-mono font-semibold">{benchmarks.direct_professions}</dd></div>
              <div><dt className="text-muted">Смежный срез</dt><dd className="mt-1 font-mono font-semibold">{benchmarks.related_professions}</dd></div>
              <div><dt className="text-muted">Только категория</dt><dd className="mt-1 font-mono font-semibold">{benchmarks.category_only_professions}</dd></div>
              <div><dt className="text-muted">Последняя выборка</dt><dd className="mt-1 font-mono font-semibold">n={benchmarks.latest_total_sample_size.toLocaleString("ru-RU")}</dd></div>
            </dl>
            <p className="mt-5 rounded-xl border border-line p-4 text-sm leading-6">Главный источник: <a className="font-semibold text-accent" href={benchmarks.source_urls[0]} target="_blank" rel="noreferrer">Хабр Карьера</a>. Срезы содержат net и unknown-tax данные; налоговый статус всегда показан рядом с источником.</p>
          </article> : null}
        </section>
      )}

      <section className="mt-10 panel p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Пять правил корректной интерпретации</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-2">
          <li className="rounded-2xl border border-line p-5"><strong>1. Дата метрики не доказывает live-состояние.</strong><p className="mt-2 text-sm leading-6 text-muted">Всегда проверяйте статус слоя и источник даты.</p></li>
          <li className="rounded-2xl border border-line p-5"><strong>2. Публикации не равны активным вакансиям.</strong><p className="mt-2 text-sm leading-6 text-muted">Официальный ряд группируется по дате создания записи.</p></li>
          <li className="rounded-2xl border border-line p-5"><strong>3. Unknown gross/net нельзя считать gross.</strong><p className="mt-2 text-sm leading-6 text-muted">Поэтому официальные вилки не смешиваются с подготовленной gross-витриной.</p></li>
          <li className="rounded-2xl border border-line p-5"><strong>4. Недостаточно данных не означает ноль.</strong><p className="mt-2 text-sm leading-6 text-muted">Зарплатное значение скрывается, если quality gate не пройден.</p></li>
          <li className="rounded-2xl border border-line p-5"><strong>5. Категория не равна профессии.</strong><p className="mt-2 text-sm leading-6 text-muted">Категорийный fallback даёт контекст, но всегда подписан и не становится ролевой оценкой.</p></li>
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3"><Link href="/methodology" className="button-primary">Методология</Link><Link href="/sources" className="button-secondary">Источники</Link><Link href="/data-status.json" className="button-secondary">JSON статуса</Link><Link href="/open-data-daily" className="button-secondary">Ежедневный датасет</Link><Link href="/open-data-daily.json" className="button-secondary">Daily JSON</Link><Link href="/open-data-daily.csv" className="button-secondary">Daily CSV</Link><Link href="/open-data-daily.croissant.json" className="button-secondary">Croissant 1.1</Link></div>
    </div>
  );
}
