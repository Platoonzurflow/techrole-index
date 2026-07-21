import type { Metadata } from "next";
import { Paywall } from "@/components/Paywall";
import { ProfessionCard } from "@/components/ProfessionCard";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Premium-дашборд", robots: { index: false, follow: false } };
export default async function DashboardPage() { const data = await safeApi<ProfessionSummary[] | null>("/dashboard", null); return <div className="shell py-12"><p className="eyebrow">Персональный радар</p><h1 className="mt-3 text-4xl font-bold">Premium-дашборд</h1><p className="mt-4 max-w-3xl text-lg text-muted">Лидеры рынка и быстрый доступ к полной аналитике, CSV-экспорту и сохранённым уведомлениям.</p>{data ? <><div className="mt-6"><a href="/alerts" className="button-secondary">Настроить уведомления</a></div><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((item) => <ProfessionCard key={item.slug} profession={item} />)}</div></> : <div className="mt-8"><Paywall title="Дашборд доступен пользователям Premium" /></div>}</div>; }
