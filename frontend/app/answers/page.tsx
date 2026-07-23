import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { buildAnswerSummary, type AnswerOpenDataItem } from "@/lib/answers";
import type { ObservedPublicationMetricsExport } from "@/lib/observed-publication-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Короткие ответы о рынке IT-профессий",
  description: "Проверяемые ответы о спросе, зарплатах по уровням, регионах и недельной динамике с периодом, выборкой и источником.",
  alternates: { canonical: "/answers" },
};

const levelLabels = { junior: "Junior", middle: "Middle", senior: "Senior" };
const money = (value: number) => `${Math.round(value).toLocaleString("ru-RU")} ₽/мес.`;

export default async function AnswersPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let items: AnswerOpenDataItem[];
  let daily: ObservedPublicationMetricsExport;
  try {
    [items, daily] = await Promise.all([
      api<AnswerOpenDataItem[]>("/open-data/publications"),
      api<ObservedPublicationMetricsExport>("/open-data/publication-metrics-daily"),
    ]);
  } catch {
    return <div className="shell py-20"><h1 className="text-4xl font-bold">Короткие ответы о рынке</h1><p className="mt-4 text-muted">Проверяемый слой сейчас обновляется. Откройте статус данных и повторите позже.</p><Link href="/data-status" className="button-primary mt-6">Статус данных</Link></div>;
  }
  const summary = buildAnswerSummary(items, daily.records);
  const trend = summary.publication_dynamics;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/answers#page`,
    name: "Короткие ответы о рынке IT-профессий",
    url: `${siteUrl}/answers`,
    inLanguage: "ru-RU",
    dateModified: summary.date_modified,
    isPartOf: { "@type": "WebSite", name: "TechRole Index", url: siteUrl },
    mainEntity: {
      "@type": "Dataset",
      name: "Ответы по публикациям IT-вакансий",
      url: `${siteUrl}/answers`,
      temporalCoverage: summary.date_from && summary.date_to ? `${summary.date_from}/${summary.date_to}` : undefined,
      spatialCoverage: { "@type": "Place", name: "Россия" },
      isAccessibleForFree: true,
      isBasedOn: "https://trudvsem.ru/opendata/api",
      measurementTechnique: `${siteUrl}/methodology`,
      distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${siteUrl}/answers.json` },
    },
  };
  return <div className="shell py-12 lg:py-16">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <p className="eyebrow">Answer-first</p>
    <h1 className="mt-3 max-w-4xl text-4xl font-black sm:text-5xl">Короткие ответы о рынке IT-профессий</h1>
    <p className="mt-5 max-w-4xl text-lg leading-8 text-muted">Ниже — публичные ответы, которые можно проверить и процитировать. Для каждого числа указан смысл, период и ссылка на основание. Это наблюдаемые публикации, а не число одновременно активных вакансий.</p>
    <nav className="profession-toc mt-7 flex flex-wrap gap-2" aria-label="Разделы коротких ответов"><a href="#top-professions">Профессии</a><a href="#salary-by-level">Зарплаты</a><a href="#regions">Регионы</a><a href="#dynamics">Динамика</a><a href="#limitations">Ограничения</a></nav>

    <section id="top-professions" className="panel mt-10 scroll-mt-36 p-6 sm:p-8"><p className="eyebrow">Спрос</p><h2 className="mt-2 text-2xl font-bold">Какие профессии чаще встречались в публикациях?</h2><p className="mt-3 leading-7 text-muted">Топ по числу классифицированных публикаций «Работы России» за {summary.date_from ?? "—"} — {summary.date_to ?? "—"}.</p><ol className="mt-6 grid gap-3">{summary.top_professions.map((item, index) => <li key={item.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"><span><span className="mr-3 font-mono text-muted">{index + 1}</span><Link className="font-semibold text-accent" href={`/professions/${item.slug}#official-open-data`}>{item.name}</Link></span><strong className="font-mono">{item.publications.toLocaleString("ru-RU")}</strong></li>)}</ol></section>

    <section id="salary-by-level" className="panel mt-8 scroll-mt-36 p-6 sm:p-8"><p className="eyebrow">Уровни</p><h2 className="mt-2 text-2xl font-bold">Какие зарплатные срезы доступны для Junior, Middle и Senior?</h2><p className="mt-3 leading-7 text-muted">По каждому уровню показаны роли с наибольшей полной выборкой. Значение — медиана midpoint полных RUB-вилок; gross/net источником не определён. Минимум для публикации — n=3.</p><div className="mt-6 grid gap-5 lg:grid-cols-3">{summary.salary_by_level.map((level) => <article key={level.seniority} className="rounded-xl border border-line p-5"><h3 className="text-xl font-bold">{levelLabels[level.seniority]}</h3>{level.roles.length ? <ul className="mt-4 grid gap-4">{level.roles.map((role) => <li key={role.slug}><Link className="font-semibold text-accent" href={`/professions/${role.slug}#official-open-data`}>{role.name}</Link><span className="mt-1 block text-sm text-muted">{money(role.median)} · n={role.sample_size}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted">Нет срезов, прошедших порог выборки.</p>}</article>)}</div></section>

    <section id="regions" className="panel mt-8 scroll-mt-36 p-6 sm:p-8"><p className="eyebrow">География</p><h2 className="mt-2 text-2xl font-bold">В каких регионах больше наблюдаемых публикаций?</h2><p className="mt-3 leading-7 text-muted">Сумма ежедневных классифицированных публикаций по региональному полю источника за доступный материализованный период.</p><div className="mt-6 table-wrap shadow-none"><table className="data-table"><thead><tr><th>Регион</th><th>Публикации</th></tr></thead><tbody>{summary.top_regions.map((region) => <tr key={`${region.code}:${region.name}`}><td>{region.name}</td><td className="font-mono">{region.publications.toLocaleString("ru-RU")}</td></tr>)}</tbody></table></div></section>

    <section id="dynamics" className="panel mt-8 scroll-mt-36 p-6 sm:p-8"><p className="eyebrow">Динамика</p><h2 className="mt-2 text-2xl font-bold">Как изменился поток публикаций за последнюю неделю?</h2><p className="mt-4 text-3xl font-black">{trend.change_percent == null ? "Недостаточно данных" : `${trend.change_percent > 0 ? "+" : ""}${trend.change_percent.toLocaleString("ru-RU")}%`}</p><p className="mt-3 leading-7 text-muted">{trend.current_publications.toLocaleString("ru-RU")} публикаций за {trend.current_date_from ?? "—"} — {trend.current_date_to ?? "—"} против {trend.previous_publications.toLocaleString("ru-RU")} за {trend.previous_date_from ?? "—"} — {trend.previous_date_to ?? "—"}. Сравниваются два соседних семидневных календарных окна.</p></section>

    <section id="limitations" className="mt-8 scroll-mt-36 rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6 sm:p-8"><h2 className="text-2xl font-bold">Что обязательно указать при цитировании</h2><p className="mt-3 max-w-4xl leading-7 text-muted">Название среза, период, n для зарплаты, налоговый статус «не определён», источник и дату обновления. Ноль не подменяет недостаточную выборку, а публикации по дате создания не равны одновременно активным вакансиям.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/answers.json" className="button-primary">JSON ответов</Link><Link href="/methodology" className="button-secondary">Методология</Link><Link href="/citation" className="button-secondary">Как цитировать</Link><Link href="/data-status" className="button-secondary">Provenance</Link></div></section>
  </div>;
}
