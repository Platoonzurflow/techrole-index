"use client";

import * as echarts from "echarts";
import { useEffect, useRef } from "react";
import type { MetricPoint, OfficialOpenDataSummary } from "@/lib/types";

const colors = { junior: "#2694a8", middle: "#c85a38", senior: "#8a63a7" };

function Chart({ option, label }: { option: echarts.EChartsOption; label: string }) {
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
  return <div ref={ref} className="chart-shell h-80 w-full" role="img" aria-label={label} />;
}

function series(metrics: MetricPoint[], field: "salary_median" | "vacancy_count") {
  const dates = [...new Set(metrics.map((item) => item.date))];
  const levelSeries = (["junior", "middle", "senior"] as const).map((level) => ({
    name: level[0].toUpperCase() + level.slice(1),
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

export function SalaryChart({ metrics }: { metrics: MetricPoint[] }) {
  const { dates, levelSeries } = series(metrics, "salary_median");
  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (value) => value == null ? "Недостаточно данных" : `${new Intl.NumberFormat("ru-RU").format(Number(value))} ₽` },
    legend: { top: 4, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#64748b", hideOverlap: true }, axisLine: { lineStyle: { color: "#334155" } } },
    yAxis: { type: "value", axisLabel: { color: "#64748b", formatter: (value: number) => `${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } } },
    series: levelSeries,
  };
  return <Chart option={option} label="История медианной зарплаты по уровням" />;
}

export function VacancyChart({ metrics }: { metrics: MetricPoint[] }) {
  const { dates, levelSeries } = series(metrics, "vacancy_count");
  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { top: 4, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#64748b", hideOverlap: true }, axisLine: { lineStyle: { color: "#334155" } } },
    yAxis: { type: "value", axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } } },
    series: levelSeries.map((item) => ({ ...item, stack: "vacancies", areaStyle: { opacity: 0.09 } })),
  };
  return <Chart option={option} label="История активных вакансий по уровням" />;
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

export function PublicationChart({ data }: { data: OfficialOpenDataSummary }) {
  const weeks = aggregatePublicationsByWeek(data.daily_publications);
  const categoryWeeks = aggregatePublicationsByWeek(data.category_daily_publications);
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => `${Number(value)} публикаций`,
    },
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
        name: "Точно по профессии",
        type: "bar",
        large: true,
        itemStyle: { color: "#c85a38", borderRadius: [3, 3, 0, 0] },
        data: weeks.map((item) => item.count),
      },
      {
        name: "По направлению",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: "#2563eb" },
        itemStyle: { color: "#2563eb" },
        data: categoryWeeks.map((item) => item.count),
      },
    ],
  };
  return <Chart option={option} label="Точные публикации профессии и публикации направления по неделям за 180 дней" />;
}

export function OfficialSalaryChart({ data }: { data: OfficialOpenDataSummary }) {
  if (!data.salary_history.some((item) => item.median != null)) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-line p-6 text-center" role="status">
        <div><p className="font-semibold">Недостаточно данных для графика</p><p className="mt-2 text-sm text-muted">Для каждой точки нужно не менее {data.salary_min_sample} полных вилок за 30 дней.</p></div>
      </div>
    );
  }
  const dates = [...new Set(data.salary_history.map((item) => item.date))];
  const salarySeries = (["junior", "middle", "senior"] as const).map((level) => ({
    name: level[0].toUpperCase() + level.slice(1),
    type: "line" as const,
    smooth: true,
    showSymbol: false,
    connectNulls: true,
    lineStyle: { width: 2.5 },
    itemStyle: { color: colors[level] },
    data: dates.map((date) => data.salary_history.find((item) => item.date === date && item.seniority === level)?.median ?? null),
  }));
  const option: echarts.EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (value) => value == null ? "Недостаточно данных" : `${new Intl.NumberFormat("ru-RU").format(Number(value))} ₽` },
    legend: { top: 4, textStyle: { color: "#64748b" } },
    grid: { left: 10, right: 16, top: 48, bottom: 10, containLabel: true },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#64748b", hideOverlap: true }, axisLine: { lineStyle: { color: "#334155" } } },
    yAxis: { type: "value", axisLabel: { color: "#64748b", formatter: (value: number) => `${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: "rgba(100,116,139,.16)" } } },
    series: salarySeries,
  };
  return <Chart option={option} label="Реальная 30-дневная скользящая медиана зарплаты по уровням за 180 дней" />;
}
