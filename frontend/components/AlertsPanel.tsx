"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppSelect } from "@/components/AppSelect";
import { browserCsrf } from "@/lib/browser";
import type { ProfessionSummary } from "@/lib/types";

interface AlertRule { id: number; profession_name: string; metric: string; direction: string; threshold_percent: number; enabled: boolean }

export function AlertsPanel({ professions }: { professions: ProfessionSummary[] }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [message, setMessage] = useState("Загрузка…");
  const load = () => fetch("/api/v1/alerts").then(async (response) => {
    if (!response.ok) { setMessage("Уведомления доступны после входа с Premium."); return; }
    setRules(await response.json()); setMessage("");
  });
  useEffect(() => { void load(); }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/alerts", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() }, body: JSON.stringify({ profession_id: Number(form.get("profession_id")), metric: form.get("metric"), direction: form.get("direction"), threshold_percent: Number(form.get("threshold_percent")) }) });
    if (!response.ok) { setMessage("Правило не создано: проверьте Premium-доступ."); return; }
    await load();
  };
  const remove = async (id: number) => { const response = await fetch(`/api/v1/alerts/${id}`, { method: "DELETE", headers: { "X-CSRF-Token": browserCsrf() } }); if (response.ok) setRules(rules.filter((rule) => rule.id !== id)); };
  return <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><form className="panel grid content-start gap-4 p-6" onSubmit={submit}><h2 className="text-xl font-semibold">Новое правило</h2><label className="grid gap-2 text-sm">Профессия<AppSelect name="profession_id" required>{professions.map((item) => <option key={item.id} value={item.id}>{item.name_ru}</option>)}</AppSelect></label><label className="grid gap-2 text-sm">Метрика<AppSelect name="metric"><option value="demand">Спрос</option><option value="salary">Зарплата</option></AppSelect></label><label className="grid gap-2 text-sm">Направление<AppSelect name="direction"><option value="up">Рост</option><option value="down">Падение</option></AppSelect></label><label className="grid gap-2 text-sm">Порог, %<input className="field" name="threshold_percent" type="number" min="3" max="100" defaultValue="5" required /></label><button className="button-primary">Сохранить</button></form><section className="panel p-6"><h2 className="text-xl font-semibold">Сохранённые правила</h2>{message ? <p className="mt-5 text-muted" role="status">{message}</p> : null}<div className="mt-5 grid gap-3">{rules.map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"><div><strong>{rule.profession_name}</strong><p className="text-sm text-muted">{rule.metric === "demand" ? "Спрос" : "Зарплата"} · {rule.direction === "up" ? "рост" : "падение"} более {rule.threshold_percent}%</p></div><button type="button" className="button-secondary" onClick={() => remove(rule.id)}>Удалить</button></div>)}</div></section></div>;
}

