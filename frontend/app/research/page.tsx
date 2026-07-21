import type { Metadata } from "next";
import Link from "next/link";
import { safeApi } from "@/lib/api";
import { summarizeOpenData, type ResearchOpenDataItem } from "@/lib/research";

export const metadata: Metadata = {
  title: "Исследование рынка IT-профессий России за 180 дней",
  description: "Проверяемый обзор публикаций IT-вакансий из официального открытого API: период, охват профессий, топ ролей и размер зарплатных выборок.",
  alternates: { canonical: "/research" },
};

export default async function ResearchPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = await safeApi<ResearchOpenDataItem[]>("/open-data/publications", []);
  const summary = summarizeOpenData(items);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Report",
    headline: "IT-профессии России: публикации вакансий за 180 дней",
    name: "Исследовательский обзор TechRole Index по официальным открытым данным",
    description: "Суммарные классифицированные публикации по 50 IT-профессиям с периодом, provenance и контролем размера зарплатной выборки.",
    url: `${siteUrl}/research`,
    inLanguage: "ru-RU",
    dateModified: summary.lastModified,
    temporalCoverage: summary.dateFrom && summary.dateTo ? `${summary.dateFrom}/${summary.dateTo}` : undefined,
    spatialCoverage: "Россия",
    author: { "@id": `${siteUrl}/#organization` },
    publisher: { "@id": `${siteUrl}/#organization` },
    isBasedOn: `${siteUrl}/open-data.json`,
    citation: `${siteUrl}/citation`,
    mainEntity: { "@type": "Dataset", "@id": `${siteUrl}/open-data.json` },
  };

  return (
    <article className="shell py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">Официальный open-data слой</p>
      <h1 className="mt-3 max-w-5xl text-4xl font-extrabold tracking-tight sm:text-5xl">IT-профессии России: публикации вакансий за 180 дней</h1>
      <p className="mt-5 max-w-4xl text-lg leading-8 text-muted">Обзор строится из классифицированных записей официального API «Работа России». Это публикации по дате создания записи, а не историческое число одновременно активных вакансий.</p>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="panel p-6"><p className="text-sm font-bold uppercase tracking-wide text-muted">Публикации</p><p className="mt-2 text-3xl font-extrabold">{summary.totalPublications.toLocaleString("ru-RU")}</p><p className="mt-2 text-sm text-muted">после классификации</p></article>
        <article className="panel p-6"><p className="text-sm font-bold uppercase tracking-wide text-muted">Профессии с данными</p><p className="mt-2 text-3xl font-extrabold">{summary.representedProfessions} / {items.length || 50}</p><p className="mt-2 text-sm text-muted">нули не заменяются оценками</p></article>
        <article className="panel p-6"><p className="text-sm font-bold uppercase tracking-wide text-muted">Salary-ready роли</p><p className="mt-2 text-3xl font-extrabold">{summary.salaryReadyProfessions}</p><p className="mt-2 text-sm text-muted">есть seniority-срез n ≥ 20</p></article>
        <article className="panel p-6"><p className="text-sm font-bold uppercase tracking-wide text-muted">Период публикаций</p><p className="mt-2 text-lg font-extrabold">{summary.dateFrom ?? "н/д"}</p><p className="text-lg font-extrabold">{summary.dateTo ?? "н/д"}</p></article>
      </section>

      <section className="panel mt-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Наблюдаемый спрос</p><h2 className="mt-2 text-2xl font-extrabold">Топ профессий по числу публикаций</h2></div><Link href="/open-data.json" className="font-semibold text-accent">Открыть весь Dataset →</Link></div>
        <div className="table-wrap mt-6 shadow-none"><table className="data-table"><thead><tr><th>№</th><th>Профессия</th><th>Публикации</th><th>Период</th></tr></thead><tbody>{summary.top.map((item, index) => <tr key={item.slug}><td className="font-mono">{index + 1}</td><td><Link href={`/professions/${item.slug}`} className="font-semibold text-accent">{item.name_ru}</Link></td><td className="font-mono">{item.total_publications.toLocaleString("ru-RU")}</td><td className="text-muted">{item.date_from} — {item.date_to}</td></tr>)}</tbody></table></div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="panel p-6"><h2 className="text-xl font-extrabold">Что означает ноль</h2><p className="mt-3 leading-7 text-muted">Для {summary.zeroResultProfessions} узких ролей уверенных совпадений нет. Это не доказывает отсутствие вакансий на всём рынке: результат относится к выбранному источнику, периоду, запросам и порогу классификации.</p></article>
        <article className="panel p-6"><h2 className="text-xl font-extrabold">Как читать зарплату</h2><p className="mt-3 leading-7 text-muted">Медиана публикуется только по RUB-записям с двумя границами вилки и минимум 20 наблюдениями. Gross/net источником не определён, поэтому этот слой не смешивается с основной gross-витриной.</p></article>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6"><h2 className="text-xl font-extrabold">Воспроизводимость и цитирование</h2><p className="mt-3 max-w-4xl leading-7 text-muted">Указывайте профессию, период, число публикаций, дату обновления и обе ссылки: на каноническую страницу роли и на методологию. Последняя загрузка: {summary.lastModified ?? "н/д"}.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/citation" className="button-primary">Как цитировать</Link><Link href="/methodology" className="button-secondary">Методология</Link><Link href="/sources" className="button-secondary">Источники</Link></div></section>
    </article>
  );
}
