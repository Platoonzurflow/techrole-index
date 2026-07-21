"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const response = await fetch(`/api/v1/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { const payload = await response.json().catch(() => ({})); setError(typeof payload.detail === "string" ? payload.detail : "Проверьте введённые данные и повторите попытку"); setLoading(false); return; }
    router.push("/account"); router.refresh();
  }
  return <form onSubmit={submit} className="panel mx-auto mt-8 grid max-w-md gap-5 p-6 sm:p-8">{mode === "register" ? <label className="grid gap-2 text-sm font-medium">Имя<input className="field" name="display_name" minLength={2} maxLength={160} autoComplete="name" required /></label> : null}<label className="grid gap-2 text-sm font-medium">Email<input className="field" name="email" type="email" autoComplete="email" required /></label><label className="grid gap-2 text-sm font-medium">Пароль<input className="field" name="password" type="password" minLength={10} maxLength={200} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>{error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm text-negative" role="alert">{error}</p> : null}<button className="button-primary" disabled={loading}>{loading ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}</button><p className="text-center text-sm text-muted">{mode === "login" ? <>Нет аккаунта? <Link href="/register" className="font-semibold text-accent">Регистрация</Link></> : <>Уже есть аккаунт? <Link href="/login" className="font-semibold text-accent">Войти</Link></>}</p></form>;
}
