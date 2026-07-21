import type { Metadata } from "next";
import Link from "next/link";
import { PaymentStatusPoller } from "@/components/PaymentStatusPoller";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Платёж обрабатывается", robots: { index: false, follow: false } };

export default async function PaymentPendingPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  if (!orderId) return <div className="shell py-20 text-center"><h1 className="text-4xl font-bold">Не найден номер платежа</h1><Link href="/account" className="button-primary mt-7">Вернуться в кабинет</Link></div>;
  return (
    <div className="shell py-20 text-center">
      <p className="eyebrow">Статус оплаты</p>
      <h1 className="mt-3 text-4xl font-bold">Платёж обрабатывается</h1>
      <p className="mx-auto mt-4 max-w-2xl text-muted">Не закрывайте страницу сразу. Premium включится только после серверного подтверждения провайдера.</p>
      <PaymentStatusPoller orderId={orderId} />
    </div>
  );
}
