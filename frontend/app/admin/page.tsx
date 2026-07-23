import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";
import Link from "next/link";
export const metadata: Metadata = { title: "Администрирование", robots: { index: false, follow: false } };
export default function AdminPage() { return <div className="shell py-12"><p className="eyebrow">Защищённый раздел</p><h1 className="mt-3 text-4xl font-bold">Административная панель</h1><p className="mt-4 max-w-3xl text-muted">Редактирование флагов выполняется через admin-only API, каждое изменение записывается в audit log. Алиасы, классификации, scoring versions, блокировка и тестовые entitlements доступны в OpenAPI.</p><Link href="/admin/analytics" className="button-secondary mt-6">Аналитика аудитории</Link><AdminPanel /></div>; }

