import type { Metadata } from "next";
import { AlertsPanel } from "@/components/AlertsPanel";
import { Paywall } from "@/components/Paywall";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary, User } from "@/lib/types";
export const metadata: Metadata = { title: "Уведомления", robots: { index: false, follow: false } };
export default async function AlertsPage() {
  const [user, professions] = await Promise.all([
    safeApi<User | null>("/auth/me", null),
    safeApi<ProfessionSummary[]>("/professions", []),
  ]);
  const premium = user?.access_level === "premium";
  return <div className="shell py-12"><p className="eyebrow">Premium</p><h1 className="mt-3 text-4xl font-bold">Уведомления о рынке</h1><p className="mt-4 max-w-3xl leading-7 text-muted">Создавайте условия для спроса или зарплаты, временно ставьте их на паузу и возвращайтесь к карточке профессии одним кликом.</p>{premium ? <AlertsPanel professions={professions} /> : <div className="mt-8"><Paywall title="Уведомления доступны в Premium" description={user ? "После подключения Premium здесь можно создавать правила и управлять ими без технических настроек." : "Войдите в аккаунт, чтобы проверить доступ и управлять уведомлениями."} actionHref={user ? "/pricing" : "/login"} actionLabel={user ? "Посмотреть Premium" : "Войти"} /></div>}</div>;
}

