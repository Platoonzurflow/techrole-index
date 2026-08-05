import { ExternalLink } from "lucide-react";

import { rub } from "@/lib/format";
import {
  headlineSalaryBenchmarkPoint,
  salaryBenchmarkLevelPoints,
  salaryBenchmarkSourceForPoint,
  salaryLevelOrder,
} from "@/lib/salary-benchmark-data";
import type {
  OfficialOpenDataSummary,
  SalaryBenchmarkPoint,
  SalaryBenchmarkSummary,
} from "@/lib/types";


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
  technology: "данные по технологии",
  occupation_group: "широкая группа занятий",
  category: "категория",
  market_level: "общий IT-рынок",
};

const coverageLabels = {
  direct: "есть прямой срез",
  related: "есть смежный срез",
  category: "нет отдельного ролевого среза",
};

export function officialSalaryLevelsAreCoherent(official: OfficialOpenDataSummary) {
  const values = salaryLevelOrder
    .map((seniority) => official.salary_by_seniority.find(
      (item) => item.seniority === seniority,
    )?.median)
    .filter((value): value is number => value != null);
  return values.length === salaryLevelOrder.length
    && values.every((value, index) => index === 0 || value >= values[index - 1]);
}

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

function taxLabel(value: "gross" | "net" | "unknown") {
  if (value === "gross") return "до вычета налогов";
  if (value === "net") return "на руки";
  return "gross/net не указан";
}

function BenchmarkCard({ point }: { point: SalaryBenchmarkPoint }) {
  const fragment = `salary-reference-${point.source_id}-${point.scope}-${point.geography}-${point.seniority ?? "all"}`;
  return (
    <article
      id={fragment}
      className="salary-level-card scroll-mt-24 rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5"
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">{point.seniority ? levelLabels[point.seniority] : point.label}</h4>
          <span className="badge">{scopeLabels[point.scope]}</span>
        </div>
        <p className="mt-5 text-sm text-muted">{metricLabel(point)} · {geographyLabels[point.geography]}</p>
        <p className="mt-1 font-mono text-2xl font-semibold">{pointValue(point)}</p>
        {point.seniority ? <p className="mt-2 text-xs text-muted">Срез: {point.label}</p> : null}
      </div>
      <div>
        {point.p10 != null && point.p90 != null ? (
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
            <div><dt className="text-muted">P10</dt><dd className="mt-1 font-mono">{rub(point.p10)}</dd></div>
            <div><dt className="text-muted">P90</dt><dd className="mt-1 font-mono">{rub(point.p90)}</dd></div>
          </dl>
        ) : null}
        {point.sample_size != null ? <p className="mt-4 text-xs text-muted">Выборка: n={point.sample_size}</p> : null}
        {point.note ? <p className="mt-3 text-xs leading-5 text-muted">{point.note}</p> : null}
      </div>
    </article>
  );
}

function SalaryMedianShowcase({
  point,
  maximum,
}: {
  point: SalaryBenchmarkPoint;
  maximum: number;
}) {
  const value = point.value ?? 0;
  const percentage = maximum > 0
    ? Math.min(100, Math.max(0, Math.round((value / maximum) * 100)))
    : 0;
  const accessibleLabel = `${point.label}: медиана ${rub(value)}, ${percentage}% от максимальной медианы ${rub(maximum)} в выборке TechRole Index`;

  return (
    <article
      id={`salary-reference-${point.source_id}-${point.scope}-${point.geography}-all`}
      data-testid="salary-median-showcase"
      className="salary-headline-showcase mt-6 overflow-hidden rounded-3xl border border-line bg-[rgb(var(--panel-rgb)/.55)]"
    >
      <div className="salary-headline-grid grid lg:grid-cols-2">
        <div className="salary-headline-copy flex min-h-72 flex-col justify-center p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold sm:text-2xl">{point.label}</h3>
            <span className="badge">{scopeLabels[point.scope]}</span>
          </div>
          <p className="mt-10 text-sm text-muted">Медиана · {geographyLabels[point.geography]}</p>
          <p className="mt-2 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
            {rub(value)}
          </p>
        </div>

        <div className="salary-headline-visual relative flex min-h-72 flex-col items-center justify-center overflow-hidden border-t border-line bg-[radial-gradient(circle_at_50%_45%,rgb(var(--accent-rgb)/.14),transparent_62%)] p-6 text-center lg:border-l lg:border-t-0">
          <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border-[34px] border-[rgb(var(--accent-rgb)/.07)]" />
          <p className="eyebrow">Относительно максимума</p>
          <div className="salary-headline-ring relative mt-4 size-48 sm:size-52" role="img" aria-label={accessibleLabel}>
            <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="49" fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="49"
                fill="none"
                pathLength="100"
                stroke="var(--accent)"
                strokeDasharray={`${percentage} ${100 - percentage}`}
                strokeLinecap="round"
                strokeWidth="10"
              />
            </svg>
            <div className="absolute inset-0 grid place-content-center">
              <strong className="font-mono text-4xl font-semibold">{percentage}%</strong>
              <span className="mt-1 text-xs text-muted">от максимума</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            Максимальная медиана в выборке: <span className="font-mono font-semibold text-foreground">{rub(maximum)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

export function SalaryBenchmarks({
  data,
  official,
  comparisonMaximum,
}: {
  data: SalaryBenchmarkSummary;
  official?: OfficialOpenDataSummary;
  comparisonMaximum?: number;
}) {
  const headline = headlineSalaryBenchmarkPoint(data);
  const levels = salaryBenchmarkLevelPoints(data);

  return (
    <section id="salary-benchmark" className="salary-benchmark-section panel mt-10 scroll-mt-24 p-6 sm:p-8" aria-labelledby="salary-benchmark-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Зарплатные ориентиры</p>
          <h2 id="salary-benchmark-title" className="mt-2 text-2xl font-semibold">Фактические доходы специалистов</h2>
          <p className="mobile-clamp mt-3 max-w-4xl text-sm leading-6 text-muted">{data.methodology_note}</p>
        </div>
        <span className="badge confidence-medium">{coverageLabels[data.coverage]}</span>
      </div>

      {headline ? (
        <SalaryMedianShowcase
          point={headline}
          maximum={Math.max(comparisonMaximum ?? headline.value ?? 0, headline.value ?? 0)}
        />
      ) : null}

      {levels.length ? (
        <div className="mt-8">
          <h3 className="text-lg font-semibold">Зарплата Junior, Middle и Senior</h3>
          {official ? (
            <SalaryBySeniority official={official} benchmark={data} />
          ) : (
            <div className="salary-level-grid mobile-card-rail mt-4 grid gap-4 md:grid-cols-3">{levels.map((point) => <BenchmarkCard key={`${point.source_id}-${point.scope}-${point.seniority}`} point={point} />)}</div>
          )}
        </div>
      ) : null}

      <div className="salary-source-grid mobile-card-rail mt-8 grid gap-3 lg:grid-cols-2">
        {data.sources.map((source) => (
          <article id={`salary-source-${source.id}`} key={source.id} className="salary-source-card scroll-mt-24 rounded-2xl border border-line p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold">{source.name}</h3><p className="mt-1 text-muted">{source.period} · {taxLabel(source.tax_status)}{source.total_sample_size ? ` · n=${source.total_sample_size.toLocaleString("ru-RU")}` : ""}</p></div>
              <a className="button-secondary" href={source.url} target="_blank" rel="noreferrer">Источник <ExternalLink size={14} /></a>
            </div>
            <p className="mt-3 leading-6 text-muted">{source.methodology_note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SalaryBySeniority({
  official,
  benchmark,
}: {
  official: OfficialOpenDataSummary;
  benchmark: SalaryBenchmarkSummary;
}) {
  const benchmarkByLevel = new Map(
    salaryBenchmarkLevelPoints(benchmark).map((point) => [point.seniority, point]),
  );
  const officialByLevel = new Map(
    official.salary_by_seniority.map((item) => [item.seniority, item]),
  );
  const latestHistoryByLevel = new Map(
    salaryLevelOrder.map((seniority) => [
      seniority,
      [...official.salary_history]
        .reverse()
        .find((item) => item.seniority === seniority && item.average != null),
    ]),
  );

  return (
    <>
      <div className="salary-level-grid mobile-card-rail mt-5 grid gap-4 lg:grid-cols-3">
      {salaryLevelOrder.map((seniority) => {
        const observed = officialByLevel.get(seniority);
        const historyPoint = latestHistoryByLevel.get(seniority);
        const reference = benchmarkByLevel.get(seniority);
        const useObserved = historyPoint?.average != null;
        const source = reference
          ? salaryBenchmarkSourceForPoint(benchmark, reference)
          : undefined;
        const sourceName = useObserved ? official.source_name : source?.name;
        const period = useObserved
          ? `${official.date_from} — ${official.date_to}`
          : source?.period;
        const value = useObserved
          ? rub(historyPoint!.average)
          : reference
            ? pointValue(reference)
            : "Источник не найден";
        const basis = useObserved
          ? `Среднее полной RUB-вилки за скользящие ${official.salary_history_window_days ?? 30} дней`
          : reference
            ? `${metricLabel(reference)} · ${reference.label}`
            : "Нет проверяемого среза";

        return (
          <article id={`salary-level-${seniority}`} key={seniority} className="salary-level-card scroll-mt-24 rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold">{levelLabels[seniority]}</h4>
              <span className={`badge ${useObserved ? "confidence-medium" : ""}`}>
                {useObserved
                  ? historyPoint!.scope === "category"
                    ? "направление"
                    : historyPoint!.scope === "market"
                      ? "общий IT-рынок"
                      : "точная профессия"
                  : scopeLabels[reference?.scope ?? "market_level"]}
              </span>
            </div>
            <p className="mt-5 text-sm text-muted">{basis}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
            <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm">
              <div><dt className="text-muted">Источник</dt><dd className="mt-1 font-medium">{sourceName}</dd></div>
              <div><dt className="text-muted">Период</dt><dd className="mt-1">{period}</dd></div>
              <div><dt className="text-muted">Выборка главного графика</dt><dd className="mt-1 font-mono">n={historyPoint?.sample_size ?? 0}</dd></div>
              {!useObserved && source ? (
                <div><dt className="text-muted">Данные исследования</dt><dd className="mt-1">{reference?.sample_size ? `n=${reference.sample_size}` : source.total_sample_size ? `вся база n=${source.total_sample_size.toLocaleString("ru-RU")}` : "публичный агрегат"} · {taxLabel(source.tax_status)}</dd></div>
              ) : (
                <div><dt className="text-muted">Налоговый статус</dt><dd className="mt-1">gross/net не указан</dd></div>
              )}
            </dl>
            {!useObserved ? (
              <p className="mt-4 text-xs leading-5 text-muted">
                {observed?.median != null
                  ? "В главном графике пока нет устойчивой точки для этого уровня."
                  : `В наблюдаемом срезе меньше ${official.salary_min_sample} полных вилок.`} Поэтому сумма взята из указанного открытого исследования.
              </p>
            ) : null}
          </article>
        );
      })}
      </div>
    </>
  );
}
