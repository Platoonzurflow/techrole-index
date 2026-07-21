"use client";

import { useEffect, useState } from "react";
import { browserCsrf } from "@/lib/browser";

interface AdminProfession { id: number; slug: string; name_ru: string; name_en: string; is_premium: boolean; is_active: boolean }

export function AdminPanel() {
  const [items, setItems] = useState<AdminProfession[]>([]);
  const [message, setMessage] = useState("Загрузка…");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/admin/professions", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) {
        setMessage(response.status === 401 || response.status === 403 ? "Войдите под администратором." : "Не удалось загрузить данные.");
        return;
      }
      setItems(await response.json());
      setMessage("");
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name !== "AbortError") setMessage("Не удалось загрузить данные.");
    });
    return () => controller.abort();
  }, []);
  const toggle = async (item: AdminProfession, field: "is_premium" | "is_active") => { const response = await fetch(`/api/v1/admin/professions/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() }, body: JSON.stringify({ [field]: !item[field] }) }); if (!response.ok) { setMessage("Изменение отклонено сервером."); return; } setItems(items.map((current) => current.id === item.id ? { ...current, [field]: !item[field] } : current)); };
  const recalculate = async () => { const response = await fetch("/api/v1/admin/recalculate", { method: "POST", headers: { "X-CSRF-Token": browserCsrf() } }); const payload = await response.json().catch(() => ({})); setMessage(response.ok ? `Задача поставлена: ${payload.task_id}` : "Не удалось запустить расчёт."); };
  if (!items.length) return <div className="panel mt-8 p-8 text-muted" role="status">{message}</div>;
  return <div className="mt-8"><div className="mb-5 flex flex-wrap items-center gap-3"><button type="button" className="button-primary" onClick={recalculate}>Запустить перерасчёт</button><a href="/api/v1/admin/ingestion-runs" className="button-secondary">Ingestion runs JSON</a><a href="/api/v1/admin/vacancies/uncertain" className="button-secondary">Неопределённые вакансии</a>{message ? <span className="text-sm text-muted" role="status">{message}</span> : null}</div><div className="table-wrap"><table className="data-table"><thead><tr><th>Профессия</th><th>Slug</th><th>Premium</th><th>Активна</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="font-semibold">{item.name_ru}<div className="text-sm font-normal text-muted">{item.name_en}</div></td><td className="font-mono text-sm">{item.slug}</td><td><button type="button" className={`badge ${item.is_premium ? "badge-premium" : ""}`} onClick={() => toggle(item, "is_premium")}>{item.is_premium ? "Premium" : "Public"}</button></td><td><button type="button" className={`badge ${item.is_active ? "confidence-high" : "confidence-low"}`} onClick={() => toggle(item, "is_active")}>{item.is_active ? "Да" : "Нет"}</button></td></tr>)}</tbody></table></div></div>;
}
