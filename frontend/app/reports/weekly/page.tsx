import type { Metadata } from "next";
import Link from "next/link";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary } from "@/lib/types";

interface OpenDataItem { slug: string; total_publications: number; date_from: string; date_to: string; last_ingested_at?: string }
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Еженедельный отчёт рынка IT",
  description: "Публичный еженедельный снимок TechRole Index: рейтинг и наблюдавшиеся публикации.",
  alternates: { canonical: "/reports/weekly" },
};

export default async function WeeklyReportPage() {
  const [catalog, publications] = await Promise.all([safeApi<ProfessionSummary[]>("/professions", []), safeApi<OpenDataItem[]>("/open-data/publications", [])]);
  const ranking = catalog.filter((item) => item.score != null).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  const counts = new Map(publications.map((item) => [item.slug, item]));
  const generated = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  return <article className="shell py-12 lg:py-16">
    <p className="eyebrow">Публичный отчёт</p><h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">Еженедельный отчёт рынка IT</h1>
    <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">Снимок рейтинга и наблюдавшихся публикаций, подготовленный {generated}. Это ориентир для сравнения ролей, а не обещание зарплаты или прогноз карьеры.</p>
    <section className="mt-9 panel overflow-hidden"><div className="table-wrap rounded-none border-0"><table className="data-table"><thead><tr><th>Место</th><th>Профессия</th><th>Индекс</th><th>Изменение за 7 дней</th><th>Публикации</th></tr></thead><tbody>{ranking.slice(0, 10).map((item, index) => { const observed = counts.get(item.slug); return <tr key={item.slug}><td className="font-mono text-xl">{String(index + 1).padStart(2, "0")}</td><td><Link href={`/professions/${item.slug}`} className="font-semibold hover:text-accent">{item.name_ru}</Link><div className="text-sm text-muted">{item.category_name}</div></td><td className="font-mono text-xl">{item.score ?? "—"}</td><td className="font-mono">{item.weekly_change_percent == null ? "—" : `${item.weekly_change_percent > 0 ? "+" : ""}${item.weekly_change_percent.toFixed(1)}%`}</td><td className="font-mono">{observed?.total_publications?.toLocaleString("ru-RU") ?? "—"}</td></tr>; })}</tbody></table></div></section>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Link className="button-secondary" href="/professions">Открыть каталог</Link><Link className="button-secondary" href="/data-status">Проверить происхождение данных</Link><a className="button-secondary" href="/feed.xml">Подписаться на RSS</a></div>
    <p className="mt-7 max-w-3xl text-sm leading-6 text-muted">Количество публикаций — отдельный исторический срез официального открытого API. Оно не равно числу активных вакансий и не смешивается с расчётной зарплатной витриной.</p>
  </article>;
}
