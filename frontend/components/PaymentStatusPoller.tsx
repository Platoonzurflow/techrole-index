"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PaymentOrder } from "@/lib/types";

export function PaymentStatusPoller({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState("Ждём подтверждение от платёжного провайдера…");

  useEffect(() => {
    let attempts = 0;
    let stopped = false;
    const poll = async () => {
      attempts += 1;
      const response = await fetch(`/api/v1/payments/${encodeURIComponent(orderId)}`, { cache: "no-store" });
      if (!response.ok) {
        if (!stopped) setMessage("Не удалось получить статус. Деньги повторно не списываются — обновите страницу позже.");
        return;
      }
      const order = await response.json() as PaymentOrder;
      if (order.status === "succeeded") {
        window.location.replace(`/payments/success?order_id=${encodeURIComponent(orderId)}`);
        return;
      }
      if (["canceled", "failed", "refunded"].includes(order.status)) {
        window.location.replace(`/payments/error?order_id=${encodeURIComponent(orderId)}`);
        return;
      }
      if (attempts >= 30) {
        if (!stopped) setMessage("Подтверждение занимает больше обычного. Заказ сохранён — проверьте статус позже в личном кабинете.");
        return;
      }
      if (!stopped) window.setTimeout(poll, 2000);
    };
    void poll();
    return () => { stopped = true; };
  }, [orderId]);

  return (
    <div className="panel mx-auto mt-8 max-w-xl p-7 text-left">
      <p className="text-muted" role="status">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="button-secondary" onClick={() => window.location.reload()}>Проверить снова</button>
        <Link href="/account" className="button-secondary">Личный кабинет</Link>
      </div>
    </div>
  );
}
