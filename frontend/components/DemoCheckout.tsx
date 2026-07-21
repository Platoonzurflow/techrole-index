"use client";

import { useState } from "react";
import { browserCsrf } from "@/lib/browser";
import type { PaymentOrder } from "@/lib/types";

export function DemoCheckout({ order }: { order: PaymentOrder }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const complete = async (outcome: "succeeded" | "canceled") => {
    setBusy(true);
    setMessage("Обрабатываем тестовый сценарий…");
    const response = await fetch(`/api/v1/payments/${encodeURIComponent(order.order_id)}/demo/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() },
      body: JSON.stringify({ outcome }),
    });
    if (!response.ok) {
      setMessage("Сценарий не выполнен. Деньги не списывались.");
      setBusy(false);
      return;
    }
    const next = outcome === "succeeded" ? "/payments/success" : "/payments/error";
    window.location.assign(`${next}?order_id=${encodeURIComponent(order.order_id)}`);
  };
  return (
    <div className="panel mx-auto mt-8 max-w-xl p-7 text-left">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Продукт</dt><dd className="mt-1 font-semibold">{order.product_name}</dd></div>
        <div><dt className="text-sm text-muted">Тестовая сумма</dt><dd className="mt-1 font-semibold">{new Intl.NumberFormat("ru-RU", { style: "currency", currency: order.currency }).format(Number(order.amount))}</dd></div>
      </dl>
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="button-primary" onClick={() => complete("succeeded")}>Имитировать успешную оплату</button>
        <button type="button" disabled={busy} className="button-secondary" onClick={() => complete("canceled")}>Имитировать отмену</button>
      </div>
      {message ? <p className="mt-4 text-sm text-muted" role="status">{message}</p> : null}
    </div>
  );
}
