import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BriefcaseBusiness, Crown, GitCompareArrows, LayoutDashboard, Mail, ShieldCheck, UserRound } from "lucide-react";
import { AccountActions } from "@/components/AccountActions";
import { safeApi } from "@/lib/api";
import type { PaymentCatalog, User } from "@/lib/types";

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
  const payments = await safeApi<PaymentCatalog>("/payments/products", { enabled: false, mode: "test", terms_version: "unavailable", products: [] });
  const premium = user.access_level === "premium";
  const shortcuts = [
    { href: "/professions", icon: BriefcaseBusiness, title: "Каталог профессий", text: "Зарплаты, спрос и требования рынка" },
    { href: "/compare", icon: GitCompareArrows, title: "Сравнение", text: "Сопоставьте до трёх направлений" },
    ...(premium ? [
      { href: "/dashboard", icon: LayoutDashboard, title: "Premium-дашборд", text: "Полная аналитика и длинная история" },
      { href: "/alerts", icon: Bell, title: "Уведомления", text: "Правила роста и падения показателей" },
    ] : []),
  ];

  return (
    <div className="shell py-12 lg:py-16">
      <section className={`account-hero ${premium ? "account-hero-premium" : ""}`}>
        <div className="account-avatar" aria-hidden="true">
          {premium ? <Crown size={30} /> : <UserRound size={30} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Личный кабинет</p>
          <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">{displayName(user)}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Mail size={15} aria-hidden="true" />
            <span className="truncate">{user.email}</span>
          </p>
        </div>
        <div className={`account-access ${premium ? "account-access-premium" : ""}`}>
          {premium ? <Crown size={19} aria-hidden="true" /> : <ShieldCheck size={19} aria-hidden="true" />}
          <div>
            <strong>{premium ? "Premium активен" : "Базовый доступ"}</strong>
            <span>{premium ? "Все возможности открыты" : "Основные данные доступны"}</span>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_.75fr]">
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Быстрый доступ</p>
              <h2 className="mt-2 text-2xl font-bold">Продолжить работу</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {shortcuts.map(({ href, icon: Icon, title, text }) => (
              <Link href={href} key={href} className="panel panel-lift flex min-h-32 gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={21} aria-hidden="true" /></span>
                <span>
                  <strong className="text-lg">{title}</strong>
                  <span className="mt-2 block text-sm leading-6 text-muted">{text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="panel self-start p-6">
          <h2 className="text-xl font-bold">Аккаунт</h2>
          <dl className="mt-5 grid gap-4">
            <div><dt className="text-sm text-muted">Статус</dt><dd className="mt-1 font-semibold">{premium ? "Premium" : "Free"}</dd></div>
            <div><dt className="text-sm text-muted">Роль</dt><dd className="mt-1 font-semibold">{user.role === "admin" ? "Администратор" : "Пользователь"}</dd></div>
          </dl>
          <AccountActions premium={premium} payments={payments} />
          {user.role === "admin" ? <Link href="/admin" className="button-secondary mt-3 w-full">Открыть админ-панель</Link> : null}
        </aside>
      </div>
    </div>
  );
}
