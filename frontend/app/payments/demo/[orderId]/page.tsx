import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DemoCheckout } from "@/components/DemoCheckout";
import { safeApi } from "@/lib/api";
import type { PaymentOrder } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Тестовая оплата", robots: { index: false, follow: false } };

export default async function DemoPaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await safeApi<PaymentOrder | null>(`/payments/${orderId}`, null);
  if (!order || !order.is_test) redirect("/payments/error");
  if (order.status === "succeeded") redirect(`/payments/success?order_id=${encodeURIComponent(orderId)}`);
  return (
    <div className="shell py-16 text-center">
      <p className="eyebrow">Sandbox</p>
      <h1 className="mt-3 text-4xl font-bold">Тестовая платёжная страница</h1>
      <p className="mx-auto mt-4 max-w-2xl text-muted">Здесь нет полей карты и реальных списаний. Выберите результат, чтобы проверить webhook-подобную обработку, идемпотентность и выдачу доступа.</p>
      <DemoCheckout order={order} />
    </div>
  );
}
