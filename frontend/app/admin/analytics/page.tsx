import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, ChartNoAxesColumnIncreasing, Copy, MousePointerClick, UsersRound } from "lucide-react";
import { api, safeApi } from "@/lib/api";
import type { AnalyticsOverview, User } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Аналитика аудитории", robots: { index: false, follow: false } };

const empty: AnalyticsOverview = {
  date_from: "",
  date_to: "",
  days: 30,
  totals: { unique_humans: 0, pageviews: 0, clicks: 0, citation_copies: 0, ai_referrals: 0, ai_crawler_requests: 0, search_crawler_requests: 0 },
  daily: [], top_pages: [], click_targets: [], referrers: [], crawlers: [],
  measurement_notes: { unique_humans: "", citations: "", crawlers: "" },
};

function List({ title, rows, emptyText }: { title: string; rows: Array<{ label: string; count: number }>; emptyText: string }) {
  return <section className="panel p-6"><h2 className="text-xl font-bold">{title}</h2>{rows.length ? <ol className="mt-5 grid gap-3">{rows.map((row) => <li key={row.label} className="flex items-center justify-between gap-3 border-b border-line pb-3"><span className="min-w-0 break-all text-sm">{row.label}</span><strong className="font-mono">{row.count.toLocaleString("ru-RU")}</strong></li>)}</ol> : <p className="mt-4 text-sm text-muted">{emptyText}</p>}</section>;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await safeApi<User | null>("/auth/me", null);
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/account");
  const requestedDays = Number((await searchParams).days ?? 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  let report: AnalyticsOverview;
  let unavailable = false;
  try {
    report = await api<AnalyticsOverview>(`/admin/analytics?days=${days}`);
  } catch {
    report = empty;
    unavailable = true;
  }
  const maxHumans = Math.max(1, ...report.daily.map((row) => row.unique_humans));
  const cards = [
    { label: "Уникальные посетители", value: report.totals.unique_humans, note: "согласившиеся браузеры", icon: UsersRound },
    { label: "Просмотры", value: report.totals.pageviews, note: "страницы людьми", icon: ChartNoAxesColumnIncreasing },
    { label: "Клики", value: report.totals.clicks, note: "внутренние переходы", icon: MousePointerClick },
    { label: "Сигналы цитирования", value: report.totals.citation_copies + report.totals.ai_referrals, note: `${report.totals.citation_copies} копирований · ${report.totals.ai_referrals} AI-переходов`, icon: Copy },
    { label: "AI-краулеры", value: report.totals.ai_crawler_requests, note: "явно представившиеся", icon: Bot },
  ];
  return <div className="shell py-12 lg:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Только владелец</p><h1 className="mt-3 text-4xl font-black">Аналитика аудитории</h1><p className="mt-4 max-w-3xl text-muted">Люди, клики, измеримые сигналы цитирования и обращения официально заявленных краулеров — без IP, email и данных форм.</p></div><Link href="/admin" className="button-secondary">Админ-панель</Link></div>
    <nav className="mt-7 flex flex-wrap gap-2" aria-label="Период отчёта">{[7, 30, 90].map((period) => <Link key={period} href={`/admin/analytics?days=${period}`} className={period === days ? "button-primary" : "button-secondary"}>{period} дней</Link>)}</nav>
    {unavailable ? <p className="mt-6 rounded-xl border border-amber-400/35 bg-amber-400/5 p-4 text-sm">Аналитика временно недоступна: нулевые значения ниже не следует интерпретировать как отсутствие посетителей.</p> : null}
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, note, icon: Icon }) => <article key={label} className="panel p-5"><Icon className="text-accent" size={21} aria-hidden="true" /><p className="mt-4 text-sm text-muted">{label}</p><p className="mt-2 font-mono text-3xl font-black">{value.toLocaleString("ru-RU")}</p><p className="mt-2 text-xs text-muted">{note}</p></article>)}</div>
    <section className="panel mt-6 p-6 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">По дням</p><h2 className="mt-2 text-2xl font-bold">Уникальные посетители</h2></div><p className="text-sm text-muted">{report.date_from || "—"} — {report.date_to || "—"}</p></div>{report.daily.length ? <div className="mt-7 flex min-h-56 items-end gap-1 overflow-x-auto border-b border-line pb-2" aria-label="График уникальных посетителей по дням">{report.daily.map((row) => <div key={row.date} className="group flex min-w-5 flex-1 flex-col items-center justify-end gap-2" title={`${row.date}: ${row.unique_humans}`}><span className="text-[10px] text-muted opacity-0 group-hover:opacity-100">{row.unique_humans}</span><span className="w-full min-w-3 rounded-t bg-accent" style={{ height: `${Math.max(2, (row.unique_humans / maxHumans) * 150)}px` }} /><span className="hidden text-[9px] text-muted sm:block">{row.date.slice(5)}</span></div>)}</div> : <p className="mt-6 text-muted">{unavailable ? "Данные не получены." : "Данные появятся после первого согласившегося посетителя."}</p>}</section>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><List title="Популярные страницы" rows={report.top_pages} emptyText="Просмотров пока нет." /><List title="Куда переходят" rows={report.click_targets} emptyText="Кликов пока нет." /><List title="Внешние источники переходов" rows={report.referrers} emptyText="Внешних переходов пока нет." /><List title="Краулеры" rows={report.crawlers} emptyText="Идентифицированных краулеров пока нет." /></div>
    <section className="mt-6 rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6"><h2 className="text-xl font-bold">Границы измерения</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-muted"><li>{report.measurement_notes.unique_humans || "Уникальность определяется по псевдонимному first-party идентификатору после согласия."}</li><li>{report.measurement_notes.citations || "Внешняя нейросеть не сообщает сайту сам факт цитирования; доступны только измеримые сигналы."}</li><li>{report.measurement_notes.crawlers || "Учитываются только официально заявленные User-Agent."}</li></ul></section>
  </div>;
}
