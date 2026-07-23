"use client";

import { useState } from "react";
import { ArrowRight, Scale } from "lucide-react";
import { AppSelect } from "@/components/AppSelect";
import { browserCsrf } from "@/lib/browser";
import { rub } from "@/lib/format";
import {
  salaryBenchmarkLevelPoints,
  salaryBenchmarkSourceForPoint,
} from "@/lib/salary-benchmark-data";
import type {
  OfficialSalarySlice,
  ProfessionDetail,
  ProfessionSummary,
  SalaryBenchmarkPoint,
} from "@/lib/types";

const pickerLabels = ["Первая профессия", "Вторая профессия", "Третья профессия"];
const salaryLevels = ["junior", "middle", "senior"] as const;

function salarySlicesAreCoherent(slices: OfficialSalarySlice[] | undefined) {
  if (!slices?.length) return false;
  const values = salaryLevels.map(
    (level) => slices.find((slice) => slice.seniority === level)?.median,
  );
  return values.every((value): value is number => value != null)
    && values.every((value, index) => index === 0 || value >= (values[index - 1] ?? 0));
}

function benchmarkValue(point: SalaryBenchmarkPoint | undefined) {
  if (!point) return null;
  if (point.metric === "range" && point.lower != null && point.upper != null) {
    return `${rub(point.lower)} — ${rub(point.upper)}`;
  }
  return point.value != null ? rub(point.value) : null;
}

function comparisonSalary(
  item: ProfessionDetail,
  level: (typeof salaryLevels)[number],
) {
  const official = item.official_open_data;
  const exactSlices = official?.salary_by_seniority;
  const exact = exactSlices?.find((slice) => slice.seniority === level);
  if (exact?.median != null && salarySlicesAreCoherent(exactSlices)) {
    return {
      value: rub(exact.median),
      basis: `Профессия · n=${exact.sample_size}`,
    };
  }

  const benchmark = item.salary_benchmark
    ? salaryBenchmarkLevelPoints(item.salary_benchmark).find(
      (point) => point.seniority === level,
    )
    : undefined;
  const value = benchmarkValue(benchmark);
  if (value) {
    const source = item.salary_benchmark && benchmark
      ? salaryBenchmarkSourceForPoint(item.salary_benchmark, benchmark)
      : undefined;
    return {
      value,
      basis: [
        source?.name ?? benchmark?.label ?? "Открытое исследование",
        benchmark?.sample_size ? `n=${benchmark.sample_size}` : null,
      ].filter(Boolean).join(" · "),
    };
  }

  const categorySlices = official?.category_salary_by_seniority;
  const category = categorySlices?.find((slice) => slice.seniority === level);
  if (category?.median != null && salarySlicesAreCoherent(categorySlices)) {
    return {
      value: rub(category.median),
      basis: `Работа России · ${item.category_name} · n=${category.sample_size}`,
    };
  }

  const categoryBenchmark = item.salary_benchmark?.points.find(
    (point) => point.scope === "category"
      && point.geography === "russia"
      && point.seniority == null,
  );
  return {
    value: benchmarkValue(categoryBenchmark) ?? "Данных пока нет",
    basis: categoryBenchmark ? item.category_name : "",
  };
}

function publicationComparison(item: ProfessionDetail) {
  const official = item.official_open_data;
  if (!official) return { value: "Данных пока нет", basis: "" };
  if (official.total_publications > 0) {
    return {
      value: official.total_publications.toLocaleString("ru-RU"),
      basis: "Работа России · профессия",
    };
  }
  return {
    value: official.category_total_publications.toLocaleString("ru-RU"),
    basis: official.category_total_publications > 0
      ? `Работа России · ${item.category_name}`
      : "",
  };
}

function remoteComparison(item: ProfessionDetail) {
  const official = item.official_open_data;
  if (!official) return { value: "Данных пока нет", basis: "" };
  if (official.total_publications > 0) {
    return {
      value: `${Math.round((official.remote_count / official.total_publications) * 100)}%`,
      basis: `Работа России · ${official.remote_count} из ${official.total_publications}`,
    };
  }
  if (official.category_total_publications > 0) {
    return {
      value: `${Math.round(
        ((official.category_remote_count ?? 0) / official.category_total_publications) * 100,
      )}%`,
      basis: `Работа России · ${item.category_name}: ${official.category_remote_count ?? 0} из ${official.category_total_publications}`,
    };
  }
  return { value: "Данных пока нет", basis: "" };
}

function ComparisonValue({ value, basis }: { value: string; basis: string }) {
  return (
    <div>
      <span className="font-mono">{value}</span>
      {basis ? <span className="mt-1 block text-xs text-muted">{basis}</span> : null}
    </div>
  );
}

export function CompareTool({ professions, initialSlugs = [] }: { professions: ProfessionSummary[]; initialSlugs?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initialSlugs.length >= 2 ? initialSlugs : professions.slice(0, 2).map((item) => item.slug));
  const [data, setData] = useState<ProfessionDetail[]>([]);
  const [message, setMessage] = useState("");

  const changeSelection = (position: number, value: string) => {
    const next = [...selected];
    if (value) next[position] = value;
    else next.splice(position, 1);
    setSelected([...new Set(next)]);
  };

  const compare = async () => {
    setMessage("Загрузка…");
    const response = await fetch(`/api/v1/compare?slugs=${encodeURIComponent(selected.join(","))}`, {
      headers: { "X-CSRF-Token": browserCsrf() },
    });
    if (!response.ok) {
      setMessage(response.status === 403 || response.status === 401
        ? "Войдите с Premium, чтобы сравнивать профессии."
        : "Не удалось загрузить сравнение.");
      return;
    }
    setData(await response.json());
    setMessage("");
  };

  return (
    <div className="mt-8">
      <section className="compare-builder" aria-label="Выбор профессий для сравнения">
        <div className="compare-builder-heading">
          <span className="compare-builder-icon"><Scale size={21} /></span>
          <div><h2>Соберите сравнение</h2><p>Выберите две обязательные роли и при желании добавьте третью.</p></div>
        </div>
        <div className="compare-picker-grid">
          {[0, 1, 2].map((position) => (
            <label className="compare-picker-card" key={position}>
              <span className="compare-picker-meta"><strong>0{position + 1}</strong><span>{position === 2 ? "необязательно" : "обязательно"}</span></span>
              <span className="compare-picker-label">{pickerLabels[position]}</span>
              <AppSelect
                  aria-label={`Профессия ${position + 1}`}
                  value={selected[position] ?? ""}
                  onChange={(event) => changeSelection(position, event.target.value)}
                >
                  <option value="">{position === 2 ? "Добавить профессию" : "Выберите профессию"}</option>
                  {professions.map((item) => <option key={item.slug} value={item.slug}>{item.name_ru}</option>)}
              </AppSelect>
            </label>
          ))}
        </div>
        <div className="compare-builder-action">
          <p>{selected.length >= 2 ? `Готово к сравнению: ${selected.length}` : "Выберите минимум две профессии"}</p>
          <button className="button-primary" type="button" onClick={compare} disabled={selected.length < 2}>Сравнить <ArrowRight className="ml-2" size={17} /></button>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-xl border border-line bg-panel p-4 text-muted" role="status">{message}</p> : null}
      {data.length ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a className="button-secondary" href={`/compare?slugs=${encodeURIComponent(data.map((item) => item.slug).join(","))}`}>Ссылка на это сравнение</a>
            <span className="text-sm text-muted">Ссылку можно сохранить или отправить коллегам.</span>
          </div>
          <div className="table-wrap mt-6">
            <table className="data-table">
              <thead><tr><th>Показатель</th>{data.map((item) => <th key={item.slug}>{item.name_ru}</th>)}</tr></thead>
              <tbody>
                <tr><td>Индекс</td>{data.map((item) => <td key={item.slug} className="font-mono text-xl">{item.score ?? "Нет расчёта"}</td>)}</tr>
                {salaryLevels.map((level) => (
                  <tr key={level}>
                    <td>Зарплата {level}</td>
                    {data.map((item) => {
                      const salary = comparisonSalary(item, level);
                      return <td key={item.slug}><ComparisonValue {...salary} /></td>;
                    })}
                  </tr>
                ))}
                <tr>
                  <td>Публикации за 180 дней</td>
                  {data.map((item) => {
                    const publications = publicationComparison(item);
                    return <td key={item.slug}><ComparisonValue {...publications} /></td>;
                  })}
                </tr>
                <tr>
                  <td>Удалённая работа</td>
                  {data.map((item) => {
                    const remote = remoteComparison(item);
                    return <td key={item.slug}><ComparisonValue {...remote} /></td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
