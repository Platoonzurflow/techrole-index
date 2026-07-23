"use client";

import Link from "next/link";
import { Bell, BellOff, Pause, Play, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AppSelect } from "@/components/AppSelect";
import { browserCsrf } from "@/lib/browser";
import type { ProfessionSummary } from "@/lib/types";

interface AlertRule {
  id: number;
  profession_id: number;
  profession_slug: string;
  profession_name: string;
  metric: "salary" | "demand";
  direction: "up" | "down";
  threshold_percent: number;
  enabled: boolean;
}

export function AlertsPanel({ professions }: { professions: ProfessionSummary[] }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [message, setMessage] = useState("Загрузка…");
  const [busyId, setBusyId] = useState<number | "create" | null>(null);

  const load = async () => {
    const response = await fetch("/api/v1/alerts");
    if (!response.ok) {
      setMessage("Уведомления доступны после входа с Premium.");
      return;
    }
    setRules(await response.json() as AlertRule[]);
    setMessage("");
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/alerts")
      .then(async (response) => {
        if (!response.ok) throw new Error("alerts unavailable");
        return response.json() as Promise<AlertRule[]>;
      })
      .then((items) => {
        if (!active) return;
        setRules(items);
        setMessage("");
      })
      .catch(() => {
        if (active) setMessage("Уведомления доступны после входа с Premium.");
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("create");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() },
      body: JSON.stringify({
        profession_id: Number(form.get("profession_id")),
        metric: form.get("metric"),
        direction: form.get("direction"),
        threshold_percent: Number(form.get("threshold_percent")),
      }),
    });
    if (!response.ok) {
      setMessage("Правило не создано. Проверьте данные и Premium-доступ.");
      setBusyId(null);
      return;
    }
    setMessage("Правило сохранено.");
    await load();
    setBusyId(null);
  };

  const toggle = async (rule: AlertRule) => {
    setBusyId(rule.id);
    const response = await fetch(`/api/v1/alerts/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (response.ok) {
      setRules((current) => current.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item));
      setMessage(rule.enabled ? "Правило приостановлено." : "Правило снова активно.");
    } else {
      setMessage("Не удалось изменить правило.");
    }
    setBusyId(null);
  };

  const remove = async (id: number) => {
    setBusyId(id);
    const response = await fetch(`/api/v1/alerts/${id}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": browserCsrf() },
    });
    if (response.ok) {
      setRules((current) => current.filter((rule) => rule.id !== id));
      setMessage("Правило удалено.");
    } else {
      setMessage("Не удалось удалить правило.");
    }
    setBusyId(null);
  };

  const activeCount = rules.filter((rule) => rule.enabled).length;

  return (
    <>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="panel flex items-center gap-4 p-5"><Bell className="text-positive" aria-hidden="true" /><div><strong className="text-2xl">{activeCount}</strong><p className="text-sm text-muted">активных правил</p></div></div>
        <div className="panel flex items-center gap-4 p-5"><BellOff className="text-muted" aria-hidden="true" /><div><strong className="text-2xl">{rules.length - activeCount}</strong><p className="text-sm text-muted">на паузе</p></div></div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <form className="panel grid content-start gap-4 p-6" onSubmit={submit}>
          <div><p className="eyebrow">Новое условие</p><h2 className="mt-2 text-xl font-semibold">Следить за показателем</h2></div>
          <label className="grid gap-2 text-sm font-semibold">Профессия<AppSelect name="profession_id" required>{professions.map((item) => <option key={item.id} value={item.id}>{item.name_ru}</option>)}</AppSelect></label>
          <label className="grid gap-2 text-sm font-semibold">Метрика<AppSelect name="metric"><option value="demand">Спрос</option><option value="salary">Зарплата</option></AppSelect></label>
          <label className="grid gap-2 text-sm font-semibold">Изменение<AppSelect name="direction"><option value="up">Рост</option><option value="down">Снижение</option></AppSelect></label>
          <label className="grid gap-2 text-sm font-semibold">Порог изменения, %<input className="field" name="threshold_percent" type="number" min="3" max="100" defaultValue="5" required /></label>
          <button className="button-primary" disabled={busyId === "create"}>{busyId === "create" ? "Сохраняем…" : "Сохранить правило"}</button>
        </form>
        <section className="panel p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Ваш контроль</p><h2 className="mt-2 text-xl font-semibold">Сохранённые правила</h2></div><span className="badge">{rules.length} всего</span></div>
          {message ? <p className="mt-5 text-sm text-muted" role="status">{message}</p> : null}
          {!message && rules.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-line p-8 text-center text-muted"><Bell size={28} className="mx-auto mb-3" aria-hidden="true" />Создайте первое правило слева.</div> : null}
          <div className="mt-5 grid gap-3">
            {rules.map((rule) => (
              <article key={rule.id} className={`rounded-xl border p-4 ${rule.enabled ? "border-line" : "border-dashed border-line opacity-70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/professions/${rule.profession_slug}`} className="font-bold hover:text-accent">{rule.profession_name}</Link>
                      <span className={`badge ${rule.enabled ? "confidence-high" : ""}`}>{rule.enabled ? "Активно" : "На паузе"}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{rule.metric === "demand" ? "Спрос" : "Зарплата"} · {rule.direction === "up" ? "рост" : "снижение"} на {rule.threshold_percent}% и больше</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="icon-button" disabled={busyId === rule.id} onClick={() => toggle(rule)} aria-label={rule.enabled ? "Поставить правило на паузу" : "Возобновить правило"}>{rule.enabled ? <Pause size={17} /> : <Play size={17} />}</button>
                    <button type="button" className="icon-button hover:text-negative" disabled={busyId === rule.id} onClick={() => remove(rule.id)} aria-label="Удалить правило"><Trash2 size={17} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
