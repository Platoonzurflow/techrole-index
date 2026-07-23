import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { safeApi } from "@/lib/api";
import type { PaymentCatalog, User } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Тарифы",
  description: "Бесплатный и Premium-доступ к аналитике IT-профессий.",
  alternates: { canonical: "/pricing" },
};

const free = [
  "Каталог 50 профессий",
  "Базовые метрики для 70% ролей",
  "Графики за последние 30 дней",
  "Публичный top-3",
];

const premium = [
  "Детали всех профессий",
  "Полный рейтинг",
  "Графики примерно за 6 месяцев",
  "Сравнение 2-3 профессий",
  "Premium-дашборд",
  "CSV-экспорт и уведомления",
];

const fallbackCatalog: PaymentCatalog = {
  enabled: false,
  mode: "test",
  terms_version: "unavailable",
  products: [{ code: "premium_30_days", name: "Premium на 30 дней", description: "Полный доступ к аналитике", amount: "290.00", currency: "RUB", access_days: 30 }],
};

function formatPrice(value: string, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(Number(value));
}

export default async function PricingPage() {
  const [payments, user] = await Promise.all([
    safeApi<PaymentCatalog>("/payments/products", fallbackCatalog),
    safeApi<User | null>("/auth/me", null),
  ]);
  const product = payments.products[0];
  const hasPremium = user?.access_level === "premium";
  return (
    <div className="shell py-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Прозрачные тарифы</p>
        <h1 className="mt-3 text-4xl font-bold">Начните бесплатно, углубляйтесь с Premium</h1>
        <p className="mt-4 text-lg text-muted">{payments.enabled && payments.mode === "test" ? "Подключён безопасный тестовый режим: можно пройти весь сценарий, но реальные деньги не списываются." : payments.enabled ? "Сумму заказа рассчитывает сервер, а платёжные данные обрабатывает защищённая форма провайдера." : "Платёжный провайдер пока не включён. Сайт не списывает деньги и не запрашивает платёжные данные."}</p>
      </div>
      {hasPremium ? (
        <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/35 bg-amber-400/10 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-amber-400/20 text-amber-700 dark:text-amber-300"><Crown size={22} aria-hidden="true" /></span>
            <div><strong className="text-lg">Premium уже активен</strong><p className="mt-1 text-sm text-muted">Все платные возможности доступны в вашем аккаунте.</p></div>
          </div>
          <Link href="/dashboard" className="button-primary">Открыть Premium</Link>
        </div>
      ) : null}
      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <article className="panel p-7">
          <p className="eyebrow">Free</p>
          <h2 className="mt-3 text-3xl font-semibold">0 ₽</h2>
          <p className="mt-2 text-muted">Для знакомства с рынком</p>
          <ul className="mt-7 grid gap-3">{free.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 shrink-0 text-positive" size={17} />{item}</li>)}</ul>
          <Link href={user ? "/account" : "/register"} className="button-secondary mt-8 w-full">{user ? "Открыть личный кабинет" : "Создать аккаунт"}</Link>
        </article>
        <article className={`panel premium-plan-card border-amber-400/40 p-7 ${hasPremium ? "premium-plan-card-active" : ""}`}>
          <p className="eyebrow text-amber-600">Premium</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="premium-old-price" aria-label="Прежняя цена 1 349 рублей">1 349 ₽</span>
            <h2 className="text-3xl font-semibold">{product ? formatPrice(product.amount, product.currency) : "290 ₽"}</h2>
          </div>
          <p className="mt-2 text-muted">{payments.enabled && payments.mode === "test" ? "Тестовый режим: сценарий можно проверить без реального списания" : payments.enabled ? "Доступ на 30 дней после подтверждения оплаты" : "Цена пакета — 290 ₽ за 30 дней. Приём платежей пока выключен, списаний нет."}</p>
          <ul className="mt-7 grid gap-3">{premium.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 shrink-0 text-positive" size={17} />{item}</li>)}</ul>
          <Link href={hasPremium ? "/dashboard" : "/account"} className="button-primary mt-8 w-full">{hasPremium ? "Premium активен — открыть" : "Открыть личный кабинет"}</Link>
          {!hasPremium ? <p className="mt-4 text-xs leading-5 text-muted">Продолжая оплату, пользователь принимает <Link className="underline" href="/legal/offer">условия оферты</Link> и подтверждает ознакомление с <Link className="underline" href="/legal/refunds">правилами возврата</Link>.</p> : null}
        </article>
      </div>
    </div>
  );
}
