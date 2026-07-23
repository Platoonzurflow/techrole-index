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
}

function statusLabel(value?: string) {
  if (!value) return "Нет данных";
  if (value === "ok" || value === "success") return "Работает";
  if (value === "running") return "Обновляется";
  if (value === "failed" || value === "error") return "Ошибка";
  return value;
}

export default async function StatusPage() {
  const status = await safeApi<Status | null>("/status", null);

  return (
    <div className="shell py-12">
      <p className="eyebrow">Наблюдаемость</p>
      <h1 className="mt-3 text-4xl font-bold">Статус обновления данных</h1>
      {!status ? (
        <div className="panel mt-8 p-8 text-muted">Статус данных временно недоступен. Попробуйте обновить страницу через несколько минут.</div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="panel p-5"><p className="text-sm text-muted">Сервис</p><p className="mt-2 text-2xl font-semibold text-positive">{statusLabel(status.service)}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Последняя дата метрик</p><p className="mt-2 font-mono text-xl font-semibold">{status.last_metric_date ?? "-"}</p></div>
            <div className="panel p-5"><p className="text-sm text-muted">Последняя загрузка</p><p className="mt-2 text-xl font-semibold">{statusLabel(status.latest_ingestion?.status)}</p><p className="mt-1 text-sm text-muted">{status.latest_ingestion?.records_seen ?? 0} записей обработано</p></div>
          </section>
        </>
      )}
    </div>
  );
}
