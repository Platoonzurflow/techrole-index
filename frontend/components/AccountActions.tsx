"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserCsrf } from "@/lib/browser";
import type { PaymentCatalog, PaymentOrder } from "@/lib/types";

function formatPrice(value: string, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(Number(value));
}

function paymentIdempotencyKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `browser-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function submitRobokassaPayment(confirmationUrl: string) {
  const target = new URL(confirmationUrl);
  if (target.protocol !== "https:" || target.hostname !== "auth.robokassa.ru") {
    throw new Error("Unexpected Robokassa payment address");
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${target.origin}${target.pathname}`;
  form.acceptCharset = "UTF-8";
  form.hidden = true;
  for (const [name, value] of target.searchParams.entries()) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}

export function AccountActions({ premium, payments }: { premium: boolean; payments: PaymentCatalog }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const logout = async () => {
    setBusy(true);
    setMessage("Выполняется…");
    const response = await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": browserCsrf() },
    });
    if (!response.ok) {
      setMessage("Не удалось выйти. Повторите попытку.");
      setBusy(false);
      return;
    }
    window.location.assign("/");
  };

  const startPayment = async (productCode: string) => {
    const product = payments.products.find((item) => item.code === productCode);
    if (!product) return;
    setBusy(true);
    setMessage("Создаём защищённый платёж…");
    const response = await fetch("/api/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": paymentIdempotencyKey(),
        "X-CSRF-Token": browserCsrf(),
      },
      body: JSON.stringify({
        product_code: product.code,
        accepted_terms: true,
        terms_version: payments.terms_version,
      }),
    });
    if (!response.ok) {
      setMessage("Платёж не создан. Деньги не списаны; попробуйте ещё раз позже.");
      setBusy(false);
      return;
    }
    const order = await response.json() as PaymentOrder;
    if (!order.confirmation_url) {
      router.push(`/payments/pending?order_id=${encodeURIComponent(order.order_id)}`);
      return;
    }
    if (payments.provider === "robokassa") {
      try {
        submitRobokassaPayment(order.confirmation_url);
      } catch {
        setMessage("Не удалось открыть защищённую форму Robokassa. Деньги не списаны.");
        setBusy(false);
      }
      return;
    }
    window.location.assign(order.confirmation_url);
  };

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {payments.enabled && payments.products.length > 0 ? <>
        <label className="flex w-full items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1 size-4 shrink-0" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>{payments.mode === "test" ? "Я понимаю, что это тест без списания, и ознакомился(лась) с " : "Я принимаю "}<Link className="underline" href="/legal/offer">офертой</Link>, <Link className="underline" href="/legal/refunds">правилами возврата</Link> и <Link className="underline" href="/legal/privacy">политикой обработки данных</Link>.</span>
        </label>
        <div className="grid w-full gap-3">
          {payments.products.map((product) => (
            <div key={product.code} className="rounded-xl border border-line bg-muted/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <strong className="block">{product.name}</strong>
                  <span className="mt-1 block text-sm leading-6 text-muted">{product.service_result}</span>
                </div>
                <button type="button" className="button-primary shrink-0" disabled={busy || !accepted} onClick={() => startPayment(product.code)}>
                  {payments.mode === "test" ? `Тестовая оплата ${formatPrice(product.amount, product.currency)}` : `${premium ? "Продлить" : "Оплатить"} ${formatPrice(product.amount, product.currency)}`}
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">В чеке: {product.receipt.name}. <Link className="underline" href={product.refund_policy_url}>Условия возврата</Link>.</p>
            </div>
          ))}
        </div>
      </> : null}
      {!payments.enabled ? <p className="w-full text-sm text-muted">Приём платежей пока выключен. Деньги и платёжные данные не запрашиваются.</p> : null}
      <button type="button" className="button-secondary w-full" disabled={busy} onClick={logout}>Выйти из аккаунта</button>
      {payments.enabled && payments.mode === "test" ? <p className="w-full text-xs text-muted">Тестовый режим: реальные деньги не списываются.</p> : null}
      {message ? <p className="w-full text-sm text-muted" role="status">{message}</p> : null}
    </div>
  );
}
