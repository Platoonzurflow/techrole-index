import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  redirect(orderId ? `/payments/pending?order_id=${encodeURIComponent(orderId)}` : "/payments/error");
}
