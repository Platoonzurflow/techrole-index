import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BriefcaseBusiness, GitCompareArrows } from "lucide-react";
import { Paywall } from "@/components/Paywall";
import { ProfessionCard } from "@/components/ProfessionCard";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary, User } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Premium-дашборд", robots: { index: false, follow: false } };
export default async function DashboardPage() {
  const [user, data] = await Promise.all([
    safeApi<User | null>("/auth/me", null),
    safeApi<ProfessionSummary[] | null>("/dashboard", null),
  ]);
  const premium = user?.access_level === "premium";
  return <div className="shell py-12"><p className="eyebrow">Персональный радар</p><h1 className="mt-3 text-4xl font-bold">Premium-дашборд</h1><p className="mt-4 max-w-3xl text-lg text-muted">Лидеры рынка и быстрый доступ к полной аналитике, сравнению и сохранённым уведомлениям.</p>{premium && data ? <><div className="mt-8 grid gap-3 sm:grid-cols-3"><Link href="/professions" className="panel panel-lift flex items-center gap-3 p-4"><BriefcaseBusiness className="text-accent" aria-hidden="true" /><span><strong className="block">{data.length} направлений</strong><span className="text-sm text-muted">в полном обзоре</span></span></Link><Link href="/compare" className="panel panel-lift flex items-center gap-3 p-4"><GitCompareArrows className="text-accent" aria-hidden="true" /><span><strong className="block">Сравнить роли</strong><span className="text-sm text-muted">до трёх за раз</span></span></Link><Link href="/alerts" className="panel panel-lift flex items-center gap-3 p-4"><Bell className="text-accent" aria-hidden="true" /><span><strong className="block">Уведомления</strong><span className="text-sm text-muted">управлять правилами</span></span></Link></div><h2 className="mt-10 text-2xl font-bold">Профессии в фокусе</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((item) => <ProfessionCard key={item.slug} profession={item} />)}</div></> : <div className="mt-8"><Paywall title="Дашборд доступен пользователям Premium" description={user ? "Откройте полный обзор профессий, быстрые сравнения и управление уведомлениями." : "Войдите в аккаунт, чтобы проверить доступ к Premium-дашборду."} actionHref={user ? "/pricing" : "/login"} actionLabel={user ? "Посмотреть Premium" : "Войти"} /></div>}</div>;
}
