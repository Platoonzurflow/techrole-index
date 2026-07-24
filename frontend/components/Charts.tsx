"use client";

import * as echarts from "echarts";
import type { LineSeriesOption } from "echarts/charts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  salaryBenchmarkLevelPoints,
  salaryBenchmarkPointRepresentative,
  salaryLevelOrder,
} from "@/lib/salary-benchmark-data";
import type {
  MetricPoint,
  OfficialOpenDataSummary,
  SalaryBenchmarkSummary,
} from "@/lib/types";

const colors = { junior: "#2694a8", middle: "#c85a38", senior: "#8a63a7" };
const levelLabels = { junior: "Junior", middle: "Middle", senior: "Senior" } as const;

function Chart({
  option,
  label,
  heightClass = "h-80",
}: {
  option: echarts.EChartsOption;
  label: string;
  heightClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.setOption({
      ...option,
      animation: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 850,
      animationEasing: "cubicOut",
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.dispose(); };
  }, [option]);
  return <div ref={ref} className={`chart-shell w-full ${heightClass}`} role="img" aria-label={label} />;
}

function series(metrics: MetricPoint[], field: "salary_median" | "vacancy_count") {
  const dates = [...new Set(metrics.map((item) => item.date))];
  const levelSeries = salaryLevelOrder.map((level) => ({
    name: levelLabels[level],
    type: "line" as const,
    smooth: true,
    showSymbol: false,
    connectNulls: true,
    lineStyle: { width: 2.5 },
    itemStyle: { color: colors[level] },
    emphasis: { focus: "series" as const, lineStyle: { width: 4 } },
    data: dates.map((date) => metrics.find((item) => item.date === date && item.seniority === level)?.[field] ?? null),
  }));
  return { dates, levelSeries };
}

export function VacancyChart({ metrics }: { metrics: MetricPoint[] }) {
  const { dates, levelSeries } = series(metrics, "vacancy_count");
  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { top: 4, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#64748b", hideOverlap: true }, axisLine: { lineStyle: { color: "#334155" } } },
    yAxis: { type: "value", minInterval: 1, axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } } },
    series: levelSeries.map((item) => ({ ...item, stack: "vacancies", areaStyle: { opacity: 0.09 } })),
  };
  return <Chart option={option} label="Расчётный объём вакансий подготовленной витрины по уровням" />;
}

export function aggregatePublicationsByWeek(
  points: OfficialOpenDataSummary["daily_publications"],
) {
  const weeks: Array<{ label: string; count: number }> = [];
  for (let index = 0; index < points.length; index += 7) {
    const slice = points.slice(index, index + 7);
    if (!slice.length) continue;
    weeks.push({
      label: `${slice[0].date} — ${slice.at(-1)?.date}`,
      count: slice.reduce((sum, item) => sum + item.count, 0),
    });
  }
  return weeks;
}

export function aggregateSalaryCoverageByWeek(
  publications: OfficialOpenDataSummary["daily_publications"],
  completeRanges: OfficialOpenDataSummary["daily_publications"],
) {
  const completeByDate = new Map(completeRanges.map((item) => [item.date, item.count]));
  const weeks: Array<{
    label: string;
    publications: number;
    completeRanges: number;
    coveragePercent: number;
  }> = [];
  for (let index = 0; index < publications.length; index += 7) {
    const slice = publications.slice(index, index + 7);
    if (!slice.length) continue;
    const publicationCount = slice.reduce((sum, item) => sum + item.count, 0);
    const completeRangeCount = slice.reduce(
      (sum, item) => sum + (completeByDate.get(item.date) ?? 0),
      0,
    );
    weeks.push({
      label: `${slice[0].date} — ${slice.at(-1)?.date}`,
      publications: publicationCount,
      completeRanges: completeRangeCount,
      coveragePercent: publicationCount > 0
        ? Math.round((completeRangeCount / publicationCount) * 1000) / 10
        : 0,
    });
  }
  return weeks;
}

function rollingAverage(values: number[], windowSize = 4) {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - windowSize + 1), index + 1);
    return Math.round((slice.reduce((sum, value) => sum + value, 0) / slice.length) * 10) / 10;
  });
}

export function PublicationChart({ data }: { data: OfficialOpenDataSummary }) {
  const useExactScope = data.total_publications >= 20;
  const weeks = aggregatePublicationsByWeek(
    useExactScope ? data.daily_publications : data.category_daily_publications,
  );
  const values = weeks.map((item) => item.count);
  const scopeLabel = useExactScope ? "точная профессия" : "направление";
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = weeks.length ? Math.round((total / weeks.length) * 10) / 10 : 0;
  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (value) => `${Number(value)} публикаций` },
    legend: { top: 4, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      data: weeks.map((item) => item.label),
      axisLabel: { color: "#64748b", hideOverlap: true },
      axisLine: { lineStyle: { color: "#334155" } },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: "#64748b" },
      splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } },
    },
    series: [
      {
        name: `Новые · ${scopeLabel}`,
        type: "bar",
        large: true,
        barMaxWidth: 24,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#ff5b62" },
            { offset: 1, color: "rgba(200,90,56,.22)" },
          ]),
          borderRadius: [6, 6, 1, 1],
        },
        data: values,
      },
      {
        name: "Среднее за 4 недели",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: "#2694a8", shadowBlur: 10, shadowColor: "rgba(38,148,168,.28)" },
        itemStyle: { color: "#2694a8" },
        data: rollingAverage(values),
      },
    ],
  };
  return (
    <div>
      <div className="chart-kpis">
        <span><strong>{scopeLabel}</strong><small>выбранный охват</small></span>
        <span><strong>{total.toLocaleString("ru-RU")}</strong><small>публикаций за период</small></span>
        <span><strong>{average.toLocaleString("ru-RU")}</strong><small>в среднем за неделю</small></span>
      </div>
      <Chart option={option} label={`Новые публикации: ${scopeLabel}, по неделям за 180 дней`} heightClass="h-[22rem]" />
    </div>
  );
}

export function SalaryCoverageChart({ data }: { data: OfficialOpenDataSummary }) {
  const useExactScope = data.total_publications >= 20;
  const publications = useExactScope ? data.daily_publications : data.category_daily_publications;
  const completeRanges = useExactScope
    ? (data.daily_complete_salary_ranges ?? [])
    : (data.category_daily_complete_salary_ranges ?? []);
  const weeks = aggregateSalaryCoverageByWeek(publications, completeRanges);
  const scopeLabel = useExactScope ? "профессии" : "направления";

  if (!weeks.some((item) => item.publications > 0)) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-line p-6 text-center" role="status">
        <div><p className="font-semibold">Публикаций пока недостаточно</p><p className="mt-2 text-sm text-muted">График появится после пополнения официального набора.</p></div>
      </div>
    );
  }

  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { top: 4, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      data: weeks.map((item) => item.label),
      axisLabel: { color: "#64748b", hideOverlap: true },
      axisLine: { lineStyle: { color: "#334155" } },
    },
    yAxis: [
      {
        type: "value",
        minInterval: 1,
        name: "публикации",
        axisLabel: { color: "#64748b" },
        splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } },
      },
      {
        type: "value",
        min: 0,
        max: 100,
        name: "% с полной вилкой",
        axisLabel: { color: "#64748b", formatter: "{value}%" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: `Новые публикации ${scopeLabel}`,
        type: "bar",
        tooltip: { valueFormatter: (value) => `${Number(value)} публикаций` },
        itemStyle: { color: "rgba(38,148,168,.52)", borderRadius: [3, 3, 0, 0] },
        data: weeks.map((item) => item.publications),
      },
      {
        name: "Полные RUB-вилки",
        type: "bar",
        tooltip: { valueFormatter: (value) => `${Number(value)} вилок` },
        itemStyle: { color: "#c85a38", borderRadius: [3, 3, 0, 0] },
        data: weeks.map((item) => item.completeRanges),
      },
      {
        name: "Доля полных вилок",
        type: "line",
        tooltip: { valueFormatter: (value) => `${Number(value)}%` },
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: "#8a63a7" },
        itemStyle: { color: "#8a63a7" },
        data: weeks.map((item) => item.coveragePercent),
      },
    ],
  };
  const totalComplete = weeks.reduce((sum, item) => sum + item.completeRanges, 0);
  const totalPublications = weeks.reduce((sum, item) => sum + item.publications, 0);
  const coverage = totalPublications
    ? Math.round((totalComplete / totalPublications) * 1000) / 10
    : 0;
  return (
    <div>
      <div className="chart-kpis">
        <span><strong>{useExactScope ? "точная профессия" : "направление"}</strong><small>выбранный охват</small></span>
        <span><strong>{totalComplete.toLocaleString("ru-RU")}</strong><small>полных RUB-вилок</small></span>
        <span><strong>{coverage}%</strong><small>полнота за период</small></span>
      </div>
      <Chart option={option} label={`Новые публикации ${scopeLabel}, полные RUB-вилки и их доля по неделям`} heightClass="h-[22rem]" />
    </div>
  );
}

export function OfficialSalaryChart({
  data,
  benchmark,
}: {
  data: OfficialOpenDataSummary;
  benchmark?: SalaryBenchmarkSummary;
}) {
  const [periodDays, setPeriodDays] = useState<30 | 90 | 180>(180);
  const allDates = [...new Set(
    data.salary_history.length > 0
      ? data.salary_history.map((item) => item.date)
      : data.daily_publications.map((item) => item.date),
  )].sort();
  const dates = useMemo(() => {
    const latestDate = allDates.at(-1);
    if (!latestDate) return [];
    const cutoff = new Date(`${latestDate}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - periodDays + 1);
    return allDates.filter((date) => new Date(`${date}T00:00:00Z`) >= cutoff);
  }, [allDates, periodDays]);
  const benchmarkByLevel = new Map(
    (benchmark ? salaryBenchmarkLevelPoints(benchmark) : []).map((point) => [point.seniority, point]),
  );
  const observedValues = new Map(
    salaryLevelOrder.map((level) => [
      level,
      new Map(
        data.salary_history
          .filter((item) => item.seniority === level && item.median != null)
          .map((item) => [item.date, item.median as number]),
      ),
    ]),
  );
  const hasInversion = dates.some((date) => {
    const junior = observedValues.get("junior")?.get(date);
    const middle = observedValues.get("middle")?.get(date);
    const senior = observedValues.get("senior")?.get(date);
    return (junior != null && middle != null && junior > middle)
      || (middle != null && senior != null && middle > senior);
  });

  const salarySeries: LineSeriesOption[] = [];
  for (const level of salaryLevelOrder) {
    const points = data.salary_history.filter((item) => item.seniority === level);
    const visiblePoints = points.filter((item) => item.median != null).length;
    if (visiblePoints >= data.salary_min_sample) {
      const scope = points.find((item) => item.median != null)?.scope ?? points[0]?.scope ?? "profession";
      salarySeries.push({
        name: `${levelLabels[level]} · ${scope === "category" ? "направление" : "профессия"}`,
        type: "line",
        smooth: true,
        showSymbol: visiblePoints < 4,
        symbolSize: 7,
        connectNulls: true,
        lineStyle: {
          width: 3,
          shadowBlur: 12,
          shadowColor: `${colors[level]}44`,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${colors[level]}32` },
            { offset: 1, color: `${colors[level]}02` },
          ]),
        },
        itemStyle: { color: colors[level] },
        data: dates.map((date) => points.find((item) => item.date === date)?.median ?? null),
      });
      continue;
    }
    const reference = benchmarkByLevel.get(level);
    const value = reference ? salaryBenchmarkPointRepresentative(reference) : undefined;
    if (value == null || dates.length === 0) continue;
    salarySeries.push({
      name: `${levelLabels[level]} · ориентир`,
      type: "line",
      showSymbol: false,
      silent: true,
      lineStyle: { width: 2, type: "dashed", opacity: 0.78 },
      itemStyle: { color: colors[level] },
      data: dates.map(() => value),
    });
  }
  const usesReference = salarySeries.some((item) => String(item.name).endsWith("ориентир"));

  if (salarySeries.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-line p-6 text-center" role="status">
        <div><p className="font-semibold">Недостаточно данных для графика</p><p className="mt-2 text-sm text-muted">Нужно не менее {data.salary_min_sample} полных RUB-вилок одного уровня по профессии или её направлению.</p></div>
      </div>
    );
  }

  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (value) => value == null ? "Недостаточно данных" : `${new Intl.NumberFormat("ru-RU").format(Number(value))} ₽` },
    legend: { top: 4, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 26, top: 48, bottom: 10, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#64748b", hideOverlap: true }, axisLine: { lineStyle: { color: "#334155" } } },
    yAxis: { type: "value", axisLabel: { color: "#64748b", formatter: (value: number) => `${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } } },
    series: salarySeries,
  };

  const visibleSummaries = salaryLevelOrder.flatMap((level) => {
    const point = [...data.salary_history]
      .reverse()
      .find((item) => item.seniority === level && item.median != null && dates.includes(item.date));
    return point?.median != null
      ? [{ level, value: point.median, scope: point.scope }]
      : [];
  });

  return (
    <div>
      <div className="chart-toolbar">
        <div className="chart-periods" aria-label="Период зарплатного графика">
          {([30, 90, 180] as const).map((days) => (
            <button
              key={days}
              type="button"
              className={periodDays === days ? "is-active" : ""}
              aria-pressed={periodDays === days}
              onClick={() => setPeriodDays(days)}
            >
              {days} дней
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">RUB в месяц · полные вилки</span>
      </div>
      {visibleSummaries.length ? (
        <div className="chart-kpis">
          {visibleSummaries.map((item) => (
            <span key={item.level}>
              <strong>{levelLabels[item.level]} · {Math.round(item.value / 1000)} тыс. ₽</strong>
              <small>{item.scope === "category" ? "направление" : "точная профессия"}</small>
            </span>
          ))}
        </div>
      ) : null}
      <Chart option={option} label={`Накопительная медиана зарплаты по уровням за ${periodDays} дней и статические ориентиры для отсутствующих рядов`} heightClass="h-[25rem]" />
      {usesReference && (
        <div className="mt-3 space-y-2 text-sm text-muted">
          <p>Пунктир — статичный ориентир открытого исследования, а не историческое наблюдение.</p>
        </div>
      )}
      <p className="mt-3 text-sm text-muted">{hasInversion ? "В текущем периоде есть пересечение. " : ""}Линии наблюдений могут пересекаться, потому что выборки уровней имеют разный состав. Значения не переставляются искусственно; для карьерного порядка используйте непротиворечивые карточки уровней выше.</p>
    </div>
  );
}
