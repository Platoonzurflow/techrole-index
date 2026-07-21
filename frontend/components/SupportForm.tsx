"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

interface SupportResponse {
  reference: string;
  status: string;
  email_sent: boolean;
  message: string;
}

const SUPPORT_TOPICS = [
  { value: "site", label: "Работа сайта", hint: "Страница, кнопка или график" },
  { value: "account", label: "Аккаунт и вход", hint: "Регистрация и доступ" },
  { value: "premium", label: "Premium", hint: "Тариф и возможности" },
  { value: "data", label: "Данные", hint: "Показатели и обновления" },
  { value: "other", label: "Другой вопрос", hint: "Всё остальное" },
] as const;

export function SupportForm() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [topic, setTopic] = useState("site");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("sending");
    setMessage("");
    setDeliveryStatus("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const csrfResponse = await fetch("/api/v1/support/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!csrfResponse.ok) throw new Error("Не удалось подготовить безопасную отправку.");
      const { csrf_token: csrfToken } = await csrfResponse.json() as { csrf_token: string };
      const response = await fetch("/api/v1/support/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          topic: String(data.get("topic") ?? "other"),
          subject: String(data.get("subject") ?? ""),
          message: String(data.get("message") ?? ""),
          website: String(data.get("website") ?? ""),
        }),
      });
      const payload = await response.json() as SupportResponse | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in payload && typeof payload.detail === "string"
          ? payload.detail
          : "Не удалось отправить обращение. Попробуйте ещё раз.");
      }
      const result = payload as SupportResponse;
      setReference(result.reference);
      setMessage(result.message);
      setDeliveryStatus(result.status);
      setState("success");
      form.reset();
      setTopic("site");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить обращение.");
    }
  };

  return (
    <form className="panel p-6 sm:p-8" onSubmit={submit} aria-busy={state === "sending"}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">Имя
          <input className="field" name="name" minLength={2} maxLength={120} autoComplete="name" required placeholder="Как к вам обращаться" />
        </label>
        <label className="grid gap-2 text-sm font-bold">Email для ответа
          <input className="field" name="email" type="email" maxLength={320} autoComplete="email" required placeholder="name@example.com" />
        </label>
        <label className="grid gap-2 text-sm font-bold">Краткая тема
          <input className="field" name="subject" minLength={4} maxLength={180} required placeholder="Например: не открывается график" />
        </label>
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-bold">Раздел</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SUPPORT_TOPICS.map((item) => (
            <label
              className={`cursor-pointer rounded-xl border p-3 transition duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)] ${topic === item.value ? "border-[var(--accent)] bg-[rgb(var(--accent-rgb)/.12)] shadow-[0_8px_24px_rgb(var(--accent-rgb)/.12)]" : "border-[var(--line)] bg-[var(--panel-soft)] hover:-translate-y-0.5 hover:border-[rgb(var(--accent-rgb)/.45)]"}`}
              key={item.value}
            >
              <input
                className="sr-only"
                type="radio"
                name="topic"
                value={item.value}
                checked={topic === item.value}
                onChange={() => setTopic(item.value)}
              />
              <span className="block text-sm font-extrabold text-ink">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted">{item.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 grid gap-2 text-sm font-bold">Что произошло
        <textarea className="field min-h-40 py-3" name="message" minLength={20} maxLength={5000} required placeholder="Опишите шаги, ожидаемый результат и что вы увидели вместо него. Не указывайте пароль или платёжные данные." />
      </label>
      <label className="absolute -left-[9999px]" aria-hidden="true">Сайт
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-muted">
        <input className="mt-1 size-4 accent-[var(--accent)]" type="checkbox" required />
        <span>Согласен передать имя, email и текст обращения для ответа службы поддержки. Не отправляйте пароли, коды подтверждения и платёжные данные.</span>
      </label>
      <button className="button-primary mt-6 w-full sm:w-auto" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Отправляем…" : "Отправить обращение"}<Send className="ml-2" size={17} />
      </button>
      {message ? (
        <div className={`mt-5 rounded-xl border p-4 text-sm ${state === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-positive" : "border-red-500/30 bg-red-500/10 text-negative"}`} role="status">
          <p className="flex items-center gap-2 font-bold">{state === "success" ? <CheckCircle2 size={18} /> : null}{message}</p>
          {reference ? <p className="mt-2 font-mono text-xs">Номер: {reference}</p> : null}
          {state === "success" && deliveryStatus === "saved" ? <p className="mt-2 text-muted">Если вопрос срочный, продублируйте его на <a className="font-bold text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p> : null}
        </div>
      ) : null}
    </form>
  );
}
