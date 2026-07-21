import { ExternalLink } from "lucide-react";

import { rub } from "@/lib/format";
import type { SalaryBenchmarkPoint, SalaryBenchmarkSummary } from "@/lib/types";


const geographyLabels = {
  russia: "Россия",
  moscow: "Москва",
  saint_petersburg: "Санкт-Петербург",
  regions: "Другие регионы",
};

const levelLabels = { junior: "Junior", middle: "Middle", senior: "Senior" };

const scopeLabels = {
  exact_role: "точная профессия",
  related_role: "смежная профессия",
  technology: "технологический срез",
  category: "категория",
  market_level: "общий рынок разработки",
};

const coverageLabels = {
  direct: "есть прямой срез",
  related: "есть смежный срез",
  category: "только категорийный ориентир",
};

function pointValue(point: SalaryBenchmarkPoint) {
  if (point.metric === "range" && point.lower != null && point.upper != null) {
    return `${rub(point.lower)} — ${rub(point.upper)}`;
  }
  return rub(point.value);
}
function metricLabel(point: SalaryBenchmarkPoint) {
  if (point.metric === "average") return "Среднее";
  if (point.metric === "range") return "Диапазон";
  return "Медиана";
}

function BenchmarkCard({ point }: { point: SalaryBenchmarkPoint }) {
  return (
    <article className="rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{point.seniority ? levelLabels[point.seniority] : point.label}</h4>
        <span className="badge">{scopeLabels[point.scope]}</span>
      </div>
      <p className="mt-5 text-sm text-muted">{metricLabel(point)} · {geographyLabels[point.geography]}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{pointValue(point)}</p>
      {point.p10 != null && point.p90 != null ? (
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
          <div><dt className="text-muted">P10</dt><dd className="mt-1 font-mono">{rub(point.p10)}</dd></div>
          <div><dt className="text-muted">P90</dt><dd className="mt-1 font-mono">{rub(point.p90)}</dd></div>
        </dl>
      ) : null}
      {point.sample_size != null ? <p className="mt-4 text-xs text-muted">Выборка: n={point.sample_size}</p> : null}
      {point.note ? <p className="mt-3 text-xs leading-5 text-muted">{point.note}</p> : null}
    </article>
  );
}

export function SalaryBenchmarks({ data }: { data: SalaryBenchmarkSummary }) {
  const national = data.points.filter(
    (point) => !point.is_fallback && point.seniority == null && point.geography === "russia",
  );
  const regional = data.points.filter(
    (point) => !point.is_fallback && point.seniority == null && point.geography !== "russia",
  );
  const levels = data.points.filter((point) => point.seniority != null);
  const category = data.points.filter((point) => point.scope === "category");

  return (
    <section className="panel mt-10 p-6 sm:p-8" aria-labelledby="salary-benchmark-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Фактические доходы специалистов</p>
          <h2 id="salary-benchmark-title" className="mt-2 text-2xl font-semibold">Рыночные ориентиры зарплаты</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">{data.methodology_note}</p>
        </div>
        <span className="badge confidence-medium">{coverageLabels[data.coverage]}</span>
      </div>

      {national.length ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">{national.map((point) => <BenchmarkCard key={`${point.source_id}-${point.scope}-${point.label}`} point={point} />)}</div>
      ) : null}

      {regional.length ? (
        <div className="mt-8">
          <h3 className="text-lg font-semibold">По регионам для профессии</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">{regional.map((point) => <BenchmarkCard key={`${point.source_id}-${point.label}-${point.geography}`} point={point} />)}</div>
        </div>
      ) : null}

      {levels.length ? (
        <div className="mt-8">
          <h3 className="text-lg font-semibold">По уровню</h3>
          <p className="mt-2 text-sm text-muted">Если точного ролевого среза нет, показан явно подписанный общий ориентир рынка разработки.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">{levels.map((point) => <BenchmarkCard key={`${point.source_id}-${point.scope}-${point.seniority}`} point={point} />)}</div>
        </div>
      ) : null}

      <div className="mt-8 border-t border-line pt-8">
        <h3 className="text-lg font-semibold">Категорийный fallback</h3>
        <p className="mt-2 text-sm text-muted">Он заполняет контекст, но не подменяет зарплату конкретной профессии.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {category.map((point) => (
            <article key={point.geography} className="rounded-2xl border border-line p-4">
              <p className="text-sm text-muted">{geographyLabels[point.geography]}</p>
              <p className="mt-2 font-mono text-xl font-semibold">{rub(point.value)}</p>
              <p className="mt-2 text-xs text-muted">{point.label}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {data.sources.map((source) => (
          <article key={source.id} className="rounded-2xl border border-line p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold">{source.name}</h3><p className="mt-1 text-muted">{source.period} · {source.tax_status === "net" ? "на руки" : "gross/net не указан"}{source.total_sample_size ? ` · n=${source.total_sample_size.toLocaleString("ru-RU")}` : ""}</p></div>
              <a className="button-secondary" href={source.url} target="_blank" rel="noreferrer">Источник <ExternalLink size={14} /></a>
            </div>
            <p className="mt-3 leading-6 text-muted">{source.methodology_note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
