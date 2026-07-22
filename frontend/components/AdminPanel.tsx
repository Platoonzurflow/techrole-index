"use client";

import { useEffect, useState } from "react";
import { browserCsrf } from "@/lib/browser";

interface AdminProfession {
  id: number;
  slug: string;
  name_ru: string;
  name_en: string;
  is_premium: boolean;
  is_active: boolean;
}

interface PaymentReadinessCheck {
  code: string;
  label: string;
  ready: boolean;
}

interface PaymentReadiness {
  provider: "demo" | "yookassa" | "robokassa";
  mode: "test" | "live";
  payments_enabled: boolean;
  test_ready: boolean;
  live_ready: boolean;
  test_checks: PaymentReadinessCheck[];
  live_checks: PaymentReadinessCheck[];
  result_url?: string;
}

function ReadinessList({ checks }: { checks: PaymentReadinessCheck[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {checks.map((check) => (
        <li className="flex gap-2" key={check.code}>
          <span aria-hidden="true" className={check.ready ? "text-emerald-600" : "text-amber-600"}>
            {check.ready ? "✓" : "○"}
          </span>
          <span>{check.label}</span>
        </li>
      ))}
    </ul>
  );
}

function PaymentReadinessCard({ data }: { data: PaymentReadiness }) {
  return (
    <section className="panel mt-8 p-6" aria-labelledby="payment-readiness-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Платежи</p>
          <h2 id="payment-readiness-title" className="mt-2 text-2xl font-bold">
            Готовность Robokassa
          </h2>
          <p className="mt-2 text-sm text-muted">
            Здесь показаны только признаки настройки. Пароли и ключи API не передаются в браузер.
          </p>
        </div>
        <span className={`badge ${data.live_ready ? "confidence-high" : "confidence-low"}`}>
          {data.live_ready ? "Готово к запуску" : "Реальные списания заблокированы"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] p-5">
          <h3 className="font-bold">Тестовый магазин</h3>
          <p className="mt-1 text-sm text-muted">
            {data.test_ready ? "Можно проводить тестовый сценарий." : "Нужно закрыть отмеченные пункты."}
          </p>
          <ReadinessList checks={data.test_checks} />
        </div>
        <div className="rounded-2xl border border-[var(--line)] p-5">
          <h3 className="font-bold">Реальные платежи</h3>
          <p className="mt-1 text-sm text-muted">
            {data.live_ready ? "Все программные блокировки сняты." : "Боевой режим остаётся выключенным."}
          </p>
          <ReadinessList checks={data.live_checks} />
        </div>
      </div>

      {data.result_url ? (
        <div className="mt-4 rounded-2xl border border-[var(--line)] p-4 text-sm">
          <span className="font-semibold">ResultURL: </span>
          <code className="break-all">{data.result_url}</code>
        </div>
      ) : null}
    </section>
  );
}

export function AdminPanel() {
  const [items, setItems] = useState<AdminProfession[]>([]);
  const [readiness, setReadiness] = useState<PaymentReadiness | null>(null);
  const [message, setMessage] = useState("Загрузка…");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/admin/professions", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setMessage(
            response.status === 401 || response.status === 403
              ? "Войдите под администратором."
              : "Не удалось загрузить данные.",
          );
          return;
        }
        setItems(await response.json());
        setMessage("");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setMessage("Не удалось загрузить данные.");
        }
      });
    fetch("/api/v1/admin/payment-readiness", { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setReadiness(await response.json());
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const toggle = async (item: AdminProfession, field: "is_premium" | "is_active") => {
    const response = await fetch(`/api/v1/admin/professions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() },
      body: JSON.stringify({ [field]: !item[field] }),
    });
    if (!response.ok) {
      setMessage("Изменение отклонено сервером.");
      return;
    }
    setItems(
      items.map((current) =>
        current.id === item.id ? { ...current, [field]: !item[field] } : current,
      ),
    );
  };

  const recalculate = async () => {
    const response = await fetch("/api/v1/admin/recalculate", {
      method: "POST",
      headers: { "X-CSRF-Token": browserCsrf() },
    });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Задача поставлена: ${payload.task_id}` : "Не удалось запустить расчёт.");
  };

  if (!items.length) {
    return (
      <div className="panel mt-8 p-8 text-muted" role="status">
        {message}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" className="button-primary" onClick={recalculate}>
          Запустить перерасчёт
        </button>
        <a href="/api/v1/admin/ingestion-runs" className="button-secondary">
          Ingestion runs JSON
        </a>
        <a href="/api/v1/admin/vacancies/uncertain" className="button-secondary">
          Неопределённые вакансии
        </a>
        {message ? (
          <span className="text-sm text-muted" role="status">
            {message}
          </span>
        ) : null}
      </div>
      {readiness ? <PaymentReadinessCard data={readiness} /> : null}
      <div className="table-wrap mt-8">
        <table className="data-table">
          <thead>
            <tr>
              <th>Профессия</th>
              <th>Slug</th>
              <th>Premium</th>
              <th>Активна</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="font-semibold">
                  {item.name_ru}
                  <div className="text-sm font-normal text-muted">{item.name_en}</div>
                </td>
                <td className="font-mono text-sm">{item.slug}</td>
                <td>
                  <button
                    type="button"
                    className={`badge ${item.is_premium ? "badge-premium" : ""}`}
                    onClick={() => toggle(item, "is_premium")}
                  >
                    {item.is_premium ? "Premium" : "Public"}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={`badge ${item.is_active ? "confidence-high" : "confidence-low"}`}
                    onClick={() => toggle(item, "is_active")}
                  >
                    {item.is_active ? "Да" : "Нет"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
