import { OfficialSalaryChart } from "@/components/Charts";
import { rub } from "@/lib/format";
import {
  headlineSalaryBenchmarkPoint,
  salaryBenchmarkLevelPoints,
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

type SalaryHistoryPoint = OfficialOpenDataSummary["salary_history"][number];
type SalaryLevel = SalaryHistoryPoint["seniority"];

export type CoherentSalarySnapshot = {
  date: string;
  points: Record<SalaryLevel, SalaryHistoryPoint>;
};

function salaryHistoryValue(point: SalaryHistoryPoint) {
  return point.median ?? point.average;
}

export function selectCoherentSalarySnapshot(
  official: OfficialOpenDataSummary,
): CoherentSalarySnapshot | undefined {
  const pointsByDate = new Map<string, Partial<Record<SalaryLevel, SalaryHistoryPoint>>>();

  for (const point of official.salary_history) {
    if (
      salaryHistoryValue(point) == null
      || point.sample_size < official.salary_min_sample
      || (point.scope != null && point.scope !== "profession")
    ) continue;

    const points = pointsByDate.get(point.date) ?? {};
    const current = points[point.seniority];
    if (!current || point.sample_size > current.sample_size) points[point.seniority] = point;
    pointsByDate.set(point.date, points);
  }

  for (const date of [...pointsByDate.keys()].sort((left, right) => right.localeCompare(left))) {
    const points = pointsByDate.get(date)!;
    const junior = points.junior;
    const middle = points.middle;
    const senior = points.senior;
    if (
      junior && salaryHistoryValue(junior) != null
      && middle && salaryHistoryValue(middle) != null
      && senior && salaryHistoryValue(senior) != null
    ) {
      return { date, points: { junior, middle, senior } };
    }
  }

  return undefined;
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
  historyDays = 30,
}: {
  data: SalaryBenchmarkSummary;
  official?: OfficialOpenDataSummary;
  comparisonMaximum?: number;
  historyDays?: number;
}) {
  const headline = headlineSalaryBenchmarkPoint(data);
  const levels = salaryBenchmarkLevelPoints(data);
  const usesHhSalary = official?.salary_gross_status === "reported_per_vacancy";

  return (
    <section id="salary-benchmark" className="salary-benchmark-section panel mt-10 scroll-mt-24 p-6 sm:p-8" aria-labelledby="salary-benchmark-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {!usesHhSalary ? <p className="eyebrow">Зарплатные ориентиры</p> : null}
          <h2 id="salary-benchmark-title" className={`${usesHhSalary ? "" : "mt-2 "}text-2xl font-semibold`}>{usesHhSalary ? "Зарплата Junior, Middle и Senior" : "Фактические доходы специалистов"}</h2>
          {usesHhSalary ? <p className="mt-2 text-sm text-muted">Медиана в месяц · до вычета налогов</p> : null}
          {!usesHhSalary ? <p className="mobile-clamp mt-3 max-w-4xl text-sm leading-6 text-muted">{data.methodology_note}</p> : null}
        </div>
        {!usesHhSalary ? <span className="badge confidence-medium">{coverageLabels[data.coverage]}</span> : null}
      </div>

      {headline && !usesHhSalary ? (
        <SalaryMedianShowcase
          point={headline}
          maximum={Math.max(comparisonMaximum ?? headline.value ?? 0, headline.value ?? 0)}
        />
      ) : null}

      {official || levels.length ? (
        <div className="mt-8">
          {official ? (
            <SalaryBySeniority official={official} benchmark={data} />
          ) : (
            <div className="salary-level-grid salary-level-reference-grid mobile-card-rail mt-4 grid gap-4 md:grid-cols-3">{levels.map((point) => <BenchmarkCard key={`${point.source_id}-${point.scope}-${point.seniority}`} point={point} />)}</div>
          )}
        </div>
      ) : null}

      {usesHhSalary && official ? (
        <article id="salary-history" className="market-stage market-stage-primary salary-main-stage mt-7 scroll-mt-24">
          <div className="market-stage-copy">
            <p className="eyebrow">Главный график</p>
            <h3 className="mt-2 text-2xl font-semibold">Как менялась зарплата в вакансиях HH</h3>
          </div>
          <div className="mt-5"><OfficialSalaryChart data={official} benchmark={data} maxPeriodDays={historyDays} /></div>
        </article>
      ) : null}
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
  const coherentSnapshot = selectCoherentSalarySnapshot(official);

  return (
    <>
      <div className="salary-level-grid salary-level-summary-grid mobile-card-rail mt-5 grid gap-4 lg:grid-cols-3">
      {salaryLevelOrder.map((seniority) => {
        const historyPoint = coherentSnapshot?.points[seniority];
        const reference = benchmarkByLevel.get(seniority);
        const observedValue = historyPoint ? salaryHistoryValue(historyPoint) : undefined;
        const useObserved = observedValue != null;
        const value = useObserved
          ? `${Math.round(observedValue / 1000)} тыс. ₽`
          : reference
            ? pointValue(reference)
            : "Источник не найден";
        const basis = reference
          ? `Ориентир · ${metricLabel(reference)} · ${reference.label}`
          : "Нет проверяемого среза";

        return (
          <article id={`salary-level-${seniority}`} key={seniority} className="salary-level-card scroll-mt-24 rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold">{levelLabels[seniority]}</h4>
              {!useObserved && reference ? <span className="text-xs text-muted">{scopeLabels[reference.scope]}</span> : null}
            </div>
            {!useObserved ? <p className="mt-5 text-sm text-muted">{basis}</p> : null}
            <p className={`${useObserved ? "mt-5" : "mt-1"} font-mono text-2xl font-semibold`}>{value}</p>
            {useObserved ? (
              <p className="mt-4 border-t border-line pt-4 font-mono text-xs text-muted">n={historyPoint?.sample_size ?? 0} из {official.salary_disclosed_count.toLocaleString("ru-RU")}</p>
            ) : reference?.sample_size ? (
              <p className="mt-4 border-t border-line pt-4 font-mono text-xs text-muted">n={reference.sample_size}</p>
            ) : null}
          </article>
        );
      })}
      </div>
    </>
  );
}
