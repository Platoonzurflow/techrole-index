import { ExternalLink } from "lucide-react";

import { rub } from "@/lib/format";
import {
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
    <article id={fragment} className="scroll-mt-24 rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{point.seniority ? levelLabels[point.seniority] : point.label}</h4>
        <span className="badge">{scopeLabels[point.scope]}</span>
      </div>
      <p className="mt-5 text-sm text-muted">{metricLabel(point)} · {geographyLabels[point.geography]}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{pointValue(point)}</p>
      {point.seniority ? <p className="mt-2 text-xs text-muted">Срез: {point.label}</p> : null}
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

export function SalaryBenchmarks({
  data,
  official,
}: {
  data: SalaryBenchmarkSummary;
  official?: OfficialOpenDataSummary;
}) {
  const national = data.points.filter(
    (point) => !point.is_fallback && point.seniority == null && point.geography === "russia",
  );
  const regional = data.points.filter(
    (point) => !point.is_fallback && point.seniority == null && point.geography !== "russia",
  );
  const levels = salaryBenchmarkLevelPoints(data);

  return (
    <section id="salary-benchmark" className="panel mt-10 scroll-mt-24 p-6 sm:p-8" aria-labelledby="salary-benchmark-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Зарплатные ориентиры</p>
          <h2 id="salary-benchmark-title" className="mt-2 text-2xl font-semibold">Фактические доходы специалистов</h2>
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
          <h3 className="text-lg font-semibold">Зарплата Junior, Middle и Senior</h3>
          <p className="mt-2 text-sm leading-6 text-muted">Для каждого уровня показано одно проверяемое значение. Медиана полных вилок за 180 дней используется при выборке от {official?.salary_min_sample ?? 3}, если последовательность Junior → Middle → Senior не противоречит сама себе. При пропуске или перевёрнутой градации выбирается один полный непротиворечивый набор одного исследования: точечные данные разных срезов не смешиваются.</p>
          {official ? (
            <SalaryBySeniority official={official} benchmark={data} />
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">{levels.map((point) => <BenchmarkCard key={`${point.source_id}-${point.scope}-${point.seniority}`} point={point} />)}</div>
          )}
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {data.sources.map((source) => (
          <article id={`salary-source-${source.id}`} key={source.id} className="scroll-mt-24 rounded-2xl border border-line p-4 text-sm">
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
  const officialCoherent = officialSalaryLevelsAreCoherent(official);

  return (
    <>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
      {salaryLevelOrder.map((seniority) => {
        const observed = officialByLevel.get(seniority);
        const reference = benchmarkByLevel.get(seniority);
        const useObserved = observed?.median != null && (officialCoherent || !reference);
        const source = reference
          ? salaryBenchmarkSourceForPoint(benchmark, reference)
          : undefined;
        const sourceName = useObserved ? official.source_name : source?.name;
        const period = useObserved
          ? `${official.date_from} — ${official.date_to}`
          : source?.period;
        const value = useObserved
          ? rub(observed.median)
          : reference
            ? pointValue(reference)
            : "Источник не найден";
        const basis = useObserved
          ? "Медиана midpoint опубликованных вилок"
          : reference
            ? `${metricLabel(reference)} · ${reference.label}`
            : "Нет проверяемого среза";

        return (
          <article id={`salary-level-${seniority}`} key={seniority} className="scroll-mt-24 rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold">{levelLabels[seniority]}</h4>
              <span className={`badge ${useObserved ? "confidence-medium" : ""}`}>
                {useObserved ? "180 дней" : scopeLabels[reference?.scope ?? "market_level"]}
              </span>
            </div>
            <p className="mt-5 text-sm text-muted">{basis}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
            <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm">
              <div><dt className="text-muted">Источник</dt><dd className="mt-1 font-medium">{sourceName}</dd></div>
              <div><dt className="text-muted">Период</dt><dd className="mt-1">{period}</dd></div>
              <div><dt className="text-muted">Вилки «Работы России»</dt><dd className="mt-1 font-mono">n={observed?.sample_size ?? 0}</dd></div>
              {!useObserved && source ? (
                <div><dt className="text-muted">Данные исследования</dt><dd className="mt-1">{reference?.sample_size ? `n=${reference.sample_size}` : source.total_sample_size ? `вся база n=${source.total_sample_size.toLocaleString("ru-RU")}` : "публичный агрегат"} · {taxLabel(source.tax_status)}</dd></div>
              ) : (
                <div><dt className="text-muted">Налоговый статус</dt><dd className="mt-1">gross/net не указан</dd></div>
              )}
            </dl>
            {!useObserved ? (
              <p className="mt-4 text-xs leading-5 text-muted">
                {observed?.median != null
                  ? "Официальные вилки сохранены, но не выбраны: их градация по уровням противоречит карьерному порядку."
                  : `В официальном 180-дневном срезе меньше ${official.salary_min_sample} полных вилок.`} Поэтому сумма взята из указанного открытого исследования.
              </p>
            ) : null}
          </article>
        );
      })}
      </div>
    </>
  );
}
