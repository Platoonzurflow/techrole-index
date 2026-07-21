"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

export const MENTORSHIP_EMAIL = CONTACT_EMAIL;

export interface MentorshipApplication {
  name: string;
  contact: string;
  direction: string;
  level: string;
  context: string;
}

interface MentorshipResponse {
  reference: string;
  status: string;
  email_sent: boolean;
  message: string;
}

export function buildMentorshipMailto(application: MentorshipApplication) {
  const subject = `Заявка на личное ведение - ${application.name}`;
  const body = [
    "Заявка на личное ведение до офера",
    "",
    `Имя: ${application.name}`,
    `Контакт: ${application.contact}`,
    `Направление: ${application.direction}`,
    `Текущий уровень: ${application.level}`,
    "",
    "Текущая ситуация и цель:",
    application.context || "Не указано",
    "",
    "Готов(а) выделять около 20 часов в неделю с учётом собеседований.",
  ].join("\n");

  return `mailto:${MENTORSHIP_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function MentorshipForm() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("sending");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const csrfResponse = await fetch("/api/v1/mentorship/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!csrfResponse.ok) throw new Error("Не удалось подготовить безопасную отправку.");
      const { csrf_token: csrfToken } = await csrfResponse.json() as { csrf_token: string };
      const response = await fetch("/api/v1/mentorship/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          name: String(data.get("name") ?? "").trim(),
          contact: String(data.get("contact") ?? "").trim(),
          direction: String(data.get("direction") ?? "Не определился(ась)"),
          level: String(data.get("level") ?? "Без коммерческого опыта"),
          context: String(data.get("context") ?? "").trim(),
          website: String(data.get("website") ?? ""),
        }),
      });
      const payload = await response.json() as MentorshipResponse | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in payload && typeof payload.detail === "string"
          ? payload.detail
          : "Не удалось отправить заявку. Попробуйте ещё раз.");
      }
      const result = payload as MentorshipResponse;
      setReference(result.reference);
      setMessage(result.message);
      setState("success");
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  };

  return (
    <form className="panel p-6 sm:p-8" onSubmit={submit} aria-busy={state === "sending"}>
      <div className="flex items-start justify-between gap-4">
        <div><p className="eyebrow">Заявка</p><h2 className="mt-2 text-2xl font-extrabold">Расскажите, где вы сейчас и чего хотите достичь</h2></div>
        <span className="insight-icon"><Mail size={19} /></span>
      </div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">Имя
          <input className="field" name="name" required maxLength={80} autoComplete="name" placeholder="Как к вам обращаться" />
        </label>
        <label className="grid gap-2 text-sm font-bold">Email или Telegram
          <input className="field" name="contact" required maxLength={120} autoComplete="email" placeholder="Для обратной связи" />
        </label>
        <label className="grid gap-2 text-sm font-bold">Направление
          <select className="field" name="direction" defaultValue="Не определился(ась)">
            <option>Не определился(ась)</option>
            <option>Frontend</option><option>Backend</option><option>Data / Analytics</option>
            <option>QA / Automation</option><option>DevOps / Infrastructure</option><option>Другое</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">Текущий уровень
          <select className="field" name="level" defaultValue="Без коммерческого опыта">
            <option>Без коммерческого опыта</option><option>Стажёр / Intern</option>
            <option>Junior</option><option>Middle</option><option>Меняю направление</option>
          </select>
        </label>
      </div>
      <label className="mt-5 grid gap-2 text-sm font-bold">Что происходит сейчас и к чему хотите прийти
        <textarea className="field min-h-32 py-3" name="context" minLength={20} maxLength={3000} required placeholder="Опыт, сложности, сроки, желаемая роль и любые важные детали" />
      </label>
      <label className="absolute -left-[9999px]" aria-hidden="true">Сайт
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-muted">
        <input className="mt-1 size-4 accent-[var(--accent)]" type="checkbox" required />
        <span>Согласен передать имя, контакт и описание ситуации для ответа по заявке. Не отправляйте пароли, коды подтверждения и платёжные данные.</span>
      </label>
      <button className="button-primary mt-6 w-full sm:w-auto" type="submit" disabled={state === "sending"}>{state === "sending" ? "Отправляем…" : "Отправить заявку"} <Send className="ml-2" size={17} /></button>
      {message ? (
        <div className={`mt-5 rounded-xl border p-4 text-sm ${state === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-positive" : "border-red-500/30 bg-red-500/10 text-negative"}`} role="status">
          <p className="flex items-center gap-2 font-bold">{state === "success" ? <CheckCircle2 size={18} /> : null}{message}</p>
          {reference ? <p className="mt-2 font-mono text-xs">Номер: {reference}</p> : null}
        </div>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-muted">Для связи напрямую: <a className="font-bold text-accent underline underline-offset-4" href={`mailto:${MENTORSHIP_EMAIL}`}>{MENTORSHIP_EMAIL}</a></p>
    </form>
  );
}
