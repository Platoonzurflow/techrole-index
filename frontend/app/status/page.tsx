import type { Metadata } from "next";
import { safeApi } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Статус данных", robots: { index: false } };

interface Status {
  service: string;
  checked_at: string;
  last_metric_date?: string;
  latest_ingestion?: {
    status: string;
    started_at: string;
    finished_at?: string;
    records_seen: number;
    error_summary?: string;
  };
  sources: Array<{ code: string; name: string; enabled: boolean }>;
  hh_runtime_enabled: boolean;
  trudvsem_runtime_enabled: boolean;
  cbr_currency_enabled: boolean;
  salary_source_audit_enabled: boolean;
  catalog_cache_enabled: boolean;
  catalog_cache_ttl_seconds: number;
  ai_classifier_enabled: boolean;
  ollama_model?: string;
  nightly_schedule: string;
  nightly_report_email_enabled: boolean;
}

function sourceTitle(source: Status["sources"][number]) {
  return source.code === "demo" ? "Встроенный аналитический источник" : source.name;
}

export default async function StatusPage() {
  const status = await safeApi<Status | null>("/status", null);
  const dagsterUrl = process.env.NEXT_PUBLIC_DAGSTER_URL ?? "http://localhost:3001";

  return (
    <div className="shell py-12">
      <p className="eyebrow">Наблюдаемость</p>
      <h1 className="mt-3 text-4xl font-bold">Статус обновления данных</h1>
      {!status ? (
        <div className="panel mt-8 p-8 text-muted">Backend недоступен. Проверьте контейнеры backend, PostgreSQL и Redis.</div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="panel p-5"><p className="text-sm text-muted">Сервис</p><p className="mt-2 text-2xl font-semibold text-positive">{status.service}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Последняя дата метрик</p><p className="mt-2 font-mono text-xl font-semibold">{status.last_metric_date ?? "-"}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Последний ingestion</p><p className="mt-2 text-xl font-semibold">{status.latest_ingestion?.status ?? "-"}</p><p className="mt-1 text-sm text-muted">{status.latest_ingestion?.records_seen ?? 0} записей</p></div>
          </section>
          <section className="panel mt-6 p-6">
            <h2 className="text-xl font-semibold">Провайдеры</h2>
            <div className="mt-5 grid gap-3">
              {status.sources.map((source) => (
                <div key={source.code} className="flex items-center justify-between border-b border-line pb-3">
                  <div><strong>{sourceTitle(source)}</strong><p className="font-mono text-sm text-muted">{source.code === "demo" ? "internal" : source.code}</p></div>
                  <span className={`badge ${source.enabled ? "confidence-high" : "confidence-low"}`}>{source.enabled ? "enabled" : "disabled"}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2 text-sm text-muted">
              <p>Работа России: {status.trudvsem_runtime_enabled ? "enabled" : "disabled"} · HH runtime: {status.hh_runtime_enabled ? "enabled" : "disabled"}</p>
              <p>Курсы ЦБ: {status.cbr_currency_enabled ? "enabled" : "disabled"} · Аудит зарплатных источников: {status.salary_source_audit_enabled ? "enabled" : "disabled"}</p>
              <p>Redis catalog/detail cache: {status.catalog_cache_enabled ? `enabled · TTL ${status.catalog_cache_ttl_seconds}с` : "disabled"}</p>
              <p>Локальная модель: {status.ai_classifier_enabled ? status.ollama_model ?? "enabled" : "disabled"}</p>
              <p>Ночной запуск: <span className="font-mono">{status.nightly_schedule}</span> · Email-отчёт: {status.nightly_report_email_enabled ? "enabled" : "disabled"}</p>
            </div>
            <a className="button-secondary mt-5" href={dagsterUrl} rel="noreferrer">Открыть Dagster</a>
          </section>
        </>
      )}
    </div>
  );
}
