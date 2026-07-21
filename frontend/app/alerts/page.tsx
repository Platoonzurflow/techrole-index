import type { Metadata } from "next";
import { AlertsPanel } from "@/components/AlertsPanel";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary } from "@/lib/types";
export const metadata: Metadata = { title: "Уведомления", robots: { index: false, follow: false } };
export default async function AlertsPage() { const professions = await safeApi<ProfessionSummary[]>("/professions", []); return <div className="shell py-12"><p className="eyebrow">Premium</p><h1 className="mt-3 text-4xl font-bold">Уведомления о рынке</h1><p className="mt-4 max-w-3xl text-muted">Сохраните правило роста или падения спроса/зарплаты. MVP хранит правила; транспорт доставки подключается отдельным законным provider в production.</p><AlertsPanel professions={professions} /></div>; }

