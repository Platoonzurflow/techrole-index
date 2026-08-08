"use client";

import * as echarts from "echarts";
import type { LineSeriesOption } from "echarts/charts";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  salaryBenchmarkLevelPoints,
  salaryBenchmarkPointRepresentative,
  salaryLevelOrder,
} from "@/lib/salary-benchmark-data";
import type {
  HhMarketEnrichmentSummary,
  MetricPoint,
  OfficialOpenDataSummary,
  SalaryBenchmarkSummary,
} from "@/lib/types";

const colors = { junior: "#2694a8", middle: "#c85a38", senior: "#8a63a7" };
const levelLabels = { junior: "Junior", middle: "Middle", senior: "Senior" } as const;
const employerColors = ["#ff5b62", "#2694a8", "#f2b84b", "#8a63a7", "#3d9b73", "#8b95a7"];

function shortDateLabel(value: string) {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(8, 10)}.${date.slice(5, 7)}`
    : value;
}

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
    const chart = echarts.init(ref.current, undefined, {
      renderer: "canvas",
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compactOption: echarts.EChartsOption = {
      ...(option.legend ? {
        legend: {
          top: 0,
          left: 4,
          right: 4,
          itemWidth: 11,
          itemHeight: 7,
          itemGap: 9,
          textStyle: { color: "#64748b", fontSize: 10 },
        },
      } : {}),
      ...(option.grid ? { grid: { left: 2, right: 7, top: 42, bottom: 2, containLabel: true } } : {}),
      ...(option.xAxis ? { xAxis: { axisLabel: { fontSize: 9, margin: 8, hideOverlap: true }, axisTick: { show: false } } } : {}),
      ...(option.yAxis ? { yAxis: { axisLabel: { fontSize: 9, margin: 6 }, axisTick: { show: false } } } : {}),
    };
    chart.setOption({
      ...option,
      tooltip: typeof option.tooltip === "object" && !Array.isArray(option.tooltip)
        ? {
            ...option.tooltip,
            confine: true,
            borderColor: "rgba(100,116,139,.22)",
            borderWidth: 1,
            extraCssText: "max-width:min(82vw,320px);border-radius:12px;box-shadow:0 14px 35px rgba(15,23,42,.18);",
          }
        : option.tooltip,
      media: [
        ...(option.media ?? []),
        {
          query: { maxWidth: 520 },
          option: compactOption,
        },
      ],
      animation: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 850,
      animationEasing: "cubicOut",
    });
    const resize = () => chart.resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(ref.current);
    window.addEventListener("resize", resize);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize); chart.dispose(); };
  }, [option]);
  return <div ref={ref} className={`chart-shell chart-interactive w-full ${heightClass}`} role="img" aria-label={label} />;
}

export function HhEmployerDashboard({
  data,
}: {
  data: HhMarketEnrichmentSummary;
}) {
  const companies = data.employer_distribution;
  const option = useMemo<echarts.EChartsOption>(() => ({
    color: employerColors,
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const item = params as { name?: string; value?: number; percent?: number };
        return `${item.name ?? "Компания"}<br/><strong>${Number(item.value ?? 0).toLocaleString("ru-RU")}</strong> вакансий · ${Number(item.percent ?? 0).toFixed(1)}%`;
      },
    },
    series: [{
      name: "Вакансии работодателей",
      type: "pie",
      radius: ["54%", "82%"],
      center: ["50%", "50%"],
      minAngle: 2,
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: "rgba(255,255,255,.7)",
        borderWidth: 3,
        borderRadius: 7,
      },
      label: { show: false },
      emphasis: {
        scaleSize: 8,
        itemStyle: { shadowBlur: 24, shadowColor: "rgba(15,23,42,.25)" },
      },
      data: companies.map((item) => ({ name: item.name, value: item.count })),
    }],
  }), [companies]);
  const maxCount = Math.max(...companies.map((item) => item.count), 1);

  if (!companies.length) return null;
  return (
    <div className="employer-dashboard mt-5">
      <div className="employer-donut">
        <Chart
          option={option}
          label="Распределение вакансий между пятью ведущими работодателями и другими компаниями"
          heightClass="h-[21rem]"
        />
      </div>
      <ol className="employer-leaderboard" aria-label="Топ работодателей">
        {companies.map((item, index) => {
          const isOther = item.id === "other";
          return (
            <li key={item.id} className={isOther ? "is-other" : undefined}>
              <span className="employer-rank" style={{ "--employer-color": employerColors[index % employerColors.length] } as CSSProperties}>
                {isOther ? "Σ" : index + 1}
              </span>
              <span className="min-w-0">
                <strong>{item.name}</strong>
                <span className="employer-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max((item.count / maxCount) * 100, 2)}%`, background: employerColors[index % employerColors.length] }} />
                </span>
              </span>
              <span className="employer-value">
                <strong>{item.count.toLocaleString("ru-RU")}</strong>
                <small>{new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 1 }).format(item.share)}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
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
    legend: { type: "scroll", top: 4, left: 8, right: 8, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#64748b", hideOverlap: true, formatter: shortDateLabel }, axisLine: { lineStyle: { color: "#334155" } } },
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

function rollingAverage(values: number[], windowSize = 4) {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - windowSize + 1), index + 1);
    return Math.round((slice.reduce((sum, value) => sum + value, 0) / slice.length) * 10) / 10;
  });
}

export function PublicationChart({
  data,
  minimumExactPublications = 20,
}: {
  data: OfficialOpenDataSummary;
  minimumExactPublications?: number;
}) {
  const hasCategoryContext = data.category_daily_publications.length > 0;
  const useExactScope = data.total_publications >= minimumExactPublications || !hasCategoryContext;
  const weeks = aggregatePublicationsByWeek(
    useExactScope ? data.daily_publications : data.category_daily_publications,
  );
  const values = weeks.map((item) => item.count);
  const scopeLabel = useExactScope
    ? data.total_publications >= minimumExactPublications
      ? "точная профессия"
      : "точная профессия · малая выборка"
    : "направление";
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = weeks.length ? Math.round((total / weeks.length) * 10) / 10 : 0;
  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (value) => `${Number(value)} публикаций` },
    legend: { type: "scroll", top: 4, left: 8, right: 8, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      data: weeks.map((item) => item.label),
      axisLabel: { color: "#64748b", hideOverlap: true, formatter: shortDateLabel },
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

export function OfficialSalaryChart({
  data,
  benchmark,
  maxPeriodDays = 180,
}: {
  data: OfficialOpenDataSummary;
  benchmark?: SalaryBenchmarkSummary;
  maxPeriodDays?: number;
}) {
  const allowedMax = maxPeriodDays >= 180 ? 180 : maxPeriodDays >= 90 ? 90 : 30;
  const [periodDays, setPeriodDays] = useState<30 | 90 | 180>(allowedMax);
  const visiblePeriodDays = Math.min(periodDays, allowedMax) as 30 | 90 | 180;
  const allDates = [...new Set(
    data.salary_history.length > 0
      ? data.salary_history.map((item) => item.date)
      : data.daily_publications.map((item) => item.date),
  )].sort();
  const dates = useMemo(() => {
    const latestDate = allDates.at(-1);
    if (!latestDate) return [];
    const cutoff = new Date(`${latestDate}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - visiblePeriodDays + 1);
    return allDates.filter((date) => new Date(`${date}T00:00:00Z`) >= cutoff);
  }, [allDates, visiblePeriodDays]);
  const benchmarkByLevel = new Map(
    (benchmark ? salaryBenchmarkLevelPoints(benchmark) : []).map((point) => [point.seniority, point]),
  );
  const observedValues = new Map(
    salaryLevelOrder.map((level) => [
      level,
      new Map(
        data.salary_history
          .filter((item) => item.seniority === level && item.average != null)
          .map((item) => [item.date, item.average as number]),
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
    const visiblePoints = points.filter((item) => item.average != null).length;
    if (visiblePoints > 0) {
      const scope = points.find((item) => item.average != null)?.scope ?? points[0]?.scope ?? "profession";
      const scopeLabel = scope === "category"
        ? "направление"
        : scope === "market"
          ? "IT-рынок"
          : "профессия";
      salarySeries.push({
        name: `${levelLabels[level]} · ${scopeLabel}`,
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
        data: dates.map((date) => points.find((item) => item.date === date)?.average ?? null),
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
    legend: { type: "scroll", top: 4, left: 8, right: 8, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 26, top: 48, bottom: 10, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#64748b", hideOverlap: true, formatter: shortDateLabel }, axisLine: { lineStyle: { color: "#334155" } } },
    yAxis: { type: "value", axisLabel: { color: "#64748b", formatter: (value: number) => `${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } } },
    series: salarySeries,
  };

  const visibleSummaries = salaryLevelOrder.flatMap((level) => {
    const point = [...data.salary_history]
      .reverse()
      .find((item) => item.seniority === level && item.average != null && dates.includes(item.date));
    return point?.average != null
      ? [{ level, value: point.average, scope: point.scope, sampleSize: point.sample_size }]
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
              className={visiblePeriodDays === days ? "is-active" : ""}
              aria-pressed={visiblePeriodDays === days}
              aria-label={days > allowedMax ? `${days} дней — доступно в Premium` : `${days} дней`}
              disabled={days > allowedMax}
              title={days > allowedMax ? "Доступно в Premium" : undefined}
              onClick={() => setPeriodDays(days)}
            >
              {days} дней{days > allowedMax ? " · Premium" : ""}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">RUB в месяц · среднее за {data.salary_history_window_days ?? 30} дней с ограничениями</span>
      </div>
      {visibleSummaries.length ? (
        <div className="chart-kpis">
          {visibleSummaries.map((item) => (
            <span key={item.level}>
              <strong>{levelLabels[item.level]} · {Math.round(item.value / 1000)} тыс. ₽</strong>
              <small>{item.scope === "category" ? "направление" : item.scope === "market" ? "IT-рынок" : "точная профессия"} · n={item.sampleSize}</small>
            </span>
          ))}
        </div>
      ) : null}
      <Chart option={option} label={`Скользящее среднее зарплаты за ${data.salary_history_window_days ?? 30} дней с ограничениями по уровням; видимый период ${visiblePeriodDays} дней`} heightClass="h-[25rem]" />
      {usesReference && (
        <div className="chart-explanation mt-3 space-y-2 text-sm text-muted">
          <p>Пунктир — статичный ориентир открытого исследования, а не историческое наблюдение.</p>
        </div>
      )}
      <p className="chart-explanation mt-3 text-sm text-muted">{hasInversion ? "В текущем периоде есть пересечение. " : ""}Линии наблюдений могут пересекаться, потому что выборки уровней имеют разный состав. Значения не переставляются искусственно; для карьерного порядка используйте непротиворечивые карточки уровней выше.</p>
    </div>
  );
}
