import type { Metadata } from "next";
import Link from "next/link";
import { AccountActions } from "@/components/AccountActions";
import { safeApi } from "@/lib/api";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false, follow: false } };

function displayName(user: User) {
  if (!user.display_name.toLocaleLowerCase("ru-RU").startsWith("демо")) return user.display_name;
  if (user.role === "admin") return "Администратор";
  return user.access_level === "premium" ? "Premium пользователь" : "Базовый пользователь";
}

export default async function AccountPage() {
  const user = await safeApi<User | null>("/auth/me", null);
  if (!user) {
    return <div className="shell py-20 text-center"><h1 className="text-4xl font-bold">Личный кабинет</h1><p className="mt-4 text-muted">Войдите, чтобы увидеть статус доступа и управлять подпиской.</p><Link href="/login" className="button-primary mt-7">Войти</Link></div>;
  }
  return (
    <div className="shell py-12">
      <p className="eyebrow">Личный кабинет</p>
      <h1 className="mt-3 text-4xl font-bold">{displayName(user)}</h1>
      <div className="panel mt-8 max-w-2xl p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-muted">Email</dt><dd className="mt-1 font-medium">{user.email}</dd></div>
          <div><dt className="text-sm text-muted">Уровень доступа</dt><dd className="mt-1"><span className={`badge ${user.access_level === "premium" ? "badge-premium" : ""}`}>{user.access_level}</span></dd></div>
          <div><dt className="text-sm text-muted">Роль</dt><dd className="mt-1 font-medium">{user.role}</dd></div>
        </dl>
        <AccountActions premium={user.access_level === "premium"} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">{user.access_level === "premium" ? <Link href="/alerts" className="button-secondary">Уведомления</Link> : null}{user.role === "admin" ? <Link href="/admin" className="button-secondary">Открыть админ-панель</Link> : null}</div>
    </div>
  );
}
