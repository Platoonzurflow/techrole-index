import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BriefcaseBusiness, Crown, GitCompareArrows, LayoutDashboard, Mail, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { AccountActions } from "@/components/AccountActions";
import { safeApi } from "@/lib/api";
import type { PaymentCatalog, PaymentHistoryItem, User } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false, follow: false } };

function displayName(user: User) {
  const cleaned = user.display_name.trim().replace(/^[+?\s]+/, "");
  if (cleaned && !cleaned.toLocaleLowerCase("ru-RU").startsWith("демо")) return cleaned;
  if (user.role === "admin") return "Администратор";
  return user.access_level === "premium" ? "Premium пользователь" : "Базовый пользователь";
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Europe/Moscow" }).format(new Date(value));
}

function formatPrice(value: string, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(Number(value));
}

const paymentStatuses: Record<string, string> = {
  creating: "Создаётся",
  pending: "Ожидает оплаты",
  waiting_for_capture: "Подтверждается",
  succeeded: "Оплачен",
  canceled: "Отменён",
  failed: "Не создан",
  refunded: "Возвращён",
};

export default async function AccountPage() {
  const user = await safeApi<User | null>("/auth/me", null);
  if (!user) {
    return <div className="shell py-20 text-center"><h1 className="text-4xl font-bold">Личный кабинет</h1><p className="mx-auto mt-4 max-w-xl text-muted">Войдите, чтобы увидеть срок доступа, платежи и уведомления. Если аккаунта ещё нет, регистрация займёт меньше минуты.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/login" className="button-primary">Войти</Link><Link href="/register" className="button-secondary">Создать аккаунт</Link></div></div>;
  }
  const [payments, paymentHistory] = await Promise.all([
    safeApi<PaymentCatalog>("/payments/products", { enabled: false, mode: "test", terms_version: "unavailable", products: [] }),
    safeApi<PaymentHistoryItem[]>("/payments", []),
  ]);
  const premium = user.access_level === "premium";
  const shortcuts = [
    { href: "/professions", icon: BriefcaseBusiness, title: "Каталог профессий", text: "Зарплаты, спрос и требования рынка" },
    { href: "/compare", icon: GitCompareArrows, title: "Сравнение", text: "Сопоставьте до трёх направлений" },
    ...(premium ? [
      { href: "/dashboard", icon: LayoutDashboard, title: "Premium-дашборд", text: "Полная аналитика и длинная история" },
      { href: "/alerts", icon: Bell, title: "Уведомления", text: "Правила роста и падения показателей" },
    ] : [
      { href: "/pricing", icon: Crown, title: "Возможности Premium", text: "Полная аналитика и уведомления" },
    ]),
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
            <span>{premium && user.premium_expires_at ? `До ${formatDate(user.premium_expires_at)}` : premium ? "Все возможности открыты" : "Основные данные доступны"}</span>
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
            {premium ? <div><dt className="text-sm text-muted">Доступ до</dt><dd className="mt-1 font-semibold">{formatDate(user.premium_expires_at)}</dd></div> : null}
            <div><dt className="text-sm text-muted">Роль</dt><dd className="mt-1 font-semibold">{user.role === "admin" ? "Администратор" : "Пользователь"}</dd></div>
          </dl>
          <AccountActions premium={premium} payments={payments} />
          {user.role === "admin" ? <><Link href="/admin/analytics" className="button-secondary mt-3 w-full">Аналитика аудитории</Link><Link href="/admin" className="button-secondary mt-3 w-full">Открыть админ-панель</Link></> : null}
        </aside>
      </div>

      <section className="panel mt-8 p-6 sm:p-8" aria-labelledby="payment-history-title">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><ReceiptText size={21} aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Покупки</p>
            <h2 id="payment-history-title" className="mt-1 text-2xl font-bold">Платежи и возвраты</h2>
          </div>
        </div>
        {paymentHistory.length ? (
          <div className="mt-6 grid gap-3">
            {paymentHistory.map((order) => (
              <article key={order.order_id} className="rounded-xl border border-line p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><strong>{order.product_name}</strong><p className="mt-1 text-sm text-muted">Заказ № {order.order_id.slice(0, 8)} · {formatDate(order.created_at)}</p></div>
                  <div className="text-left sm:text-right"><strong>{formatPrice(order.amount, order.currency)}</strong><p className="mt-1 text-sm text-muted">{paymentStatuses[order.status] ?? order.status}{order.is_test ? " · тест" : ""}</p></div>
                </div>
                {order.access_ends_at ? <p className="mt-3 text-sm text-muted">Доступ по заказу до {formatDate(order.access_ends_at)}</p> : null}
                {order.refunds.map((refund) => <p key={refund.refund_id} className="mt-3 rounded-lg bg-muted/5 px-3 py-2 text-sm">Возврат {formatPrice(refund.amount, refund.currency)}: {paymentStatuses[refund.status] ?? refund.status}</p>)}
              </article>
            ))}
          </div>
        ) : <p className="mt-5 text-sm text-muted">Покупок пока нет. Здесь появятся только безопасные сведения о статусе заказа — без реквизитов карты и данных платёжного провайдера.</p>}
      </section>
    </div>
  );
}
