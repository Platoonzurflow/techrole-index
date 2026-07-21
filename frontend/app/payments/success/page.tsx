import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeApi } from "@/lib/api";
import type { PaymentOrder } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Оплата подтверждена", robots: { index: false, follow: false } };

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  if (!orderId) redirect("/payments/error");
  const order = await safeApi<PaymentOrder | null>(`/payments/${orderId}`, null);
  if (!order) redirect("/payments/error");
  if (order.status !== "succeeded") redirect(`/payments/pending?order_id=${encodeURIComponent(orderId)}`);
  return (
    <div className="shell py-20 text-center">
      <p className="eyebrow text-positive">Подтверждено сервером</p>
      <h1 className="mt-3 text-4xl font-bold">Оплата прошла успешно</h1>
      <p className="mx-auto mt-4 max-w-2xl text-muted">Premium активирован. Номер заказа: <span className="font-mono">{order.order_id}</span>.</p>
      {order.is_test ? <p className="mx-auto mt-3 max-w-2xl text-sm text-muted">Это тестовый платёж: реальные деньги не списывались.</p> : null}
      <div className="mt-7 flex justify-center gap-3"><Link href="/dashboard" className="button-primary">Открыть дашборд</Link><Link href="/account" className="button-secondary">Личный кабинет</Link></div>
    </div>
  );
}
