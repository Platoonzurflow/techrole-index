"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
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
  const product = payments.products[0];

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
    router.push("/");
    router.refresh();
  };

  const startPayment = async () => {
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
      {premium ? (
        <div className="flex w-full items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-400/10 p-4 text-sm">
          <Crown className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" size={18} aria-hidden="true" />
          <span><strong className="block">Premium уже подключён</strong><span className="mt-1 block text-muted">Повторная покупка не требуется.</span></span>
        </div>
      ) : null}
      {!premium && payments.enabled && product ? <>
        <label className="flex w-full items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>{payments.mode === "test" ? "Я понимаю, что это тест без списания, и ознакомился(лась) с " : "Я принимаю "}<Link className="underline" href="/legal/offer">офертой</Link>, <Link className="underline" href="/legal/refunds">правилами возврата</Link> и <Link className="underline" href="/legal/privacy">политикой обработки данных</Link>.</span>
        </label>
        <button type="button" className="button-primary" disabled={busy || !accepted} onClick={startPayment}>
          {payments.mode === "test" ? `Тестовая оплата ${formatPrice(product.amount, product.currency)}` : `Оплатить ${formatPrice(product.amount, product.currency)}`}
        </button>
      </> : null}
      {!premium && !payments.enabled ? <p className="w-full text-sm text-muted">Приём платежей пока выключен. Деньги и платёжные данные не запрашиваются.</p> : null}
      <button type="button" className="button-secondary w-full" disabled={busy} onClick={logout}>Выйти из аккаунта</button>
      {payments.enabled && payments.mode === "test" ? <p className="w-full text-xs text-muted">Тестовый режим: реальные деньги не списываются.</p> : null}
      {message ? <p className="w-full text-sm text-muted" role="status">{message}</p> : null}
    </div>
  );
}
