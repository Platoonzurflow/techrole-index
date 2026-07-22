"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Scale } from "lucide-react";
import { browserCsrf } from "@/lib/browser";
import { rub } from "@/lib/format";
import type { ProfessionDetail, ProfessionSummary } from "@/lib/types";

const pickerLabels = ["Первая профессия", "Вторая профессия", "Третья профессия"];

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
              <span className="compare-select-shell">
                <select
                  className="field"
                  aria-label={`Профессия ${position + 1}`}
                  value={selected[position] ?? ""}
                  onChange={(event) => changeSelection(position, event.target.value)}
                >
                  <option value="">{position === 2 ? "Добавить профессию" : "Выберите профессию"}</option>
                  {professions.map((item) => <option key={item.slug} value={item.slug}>{item.name_ru}</option>)}
                </select>
                <ChevronDown size={18} aria-hidden="true" />
              </span>
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
        <><div className="mt-5 flex flex-wrap items-center gap-3"><a className="button-secondary" href={`/compare?slugs=${encodeURIComponent(data.map((item) => item.slug).join(","))}`}>Ссылка на это сравнение</a><span className="text-sm text-muted">Ссылку можно сохранить или отправить коллегам.</span></div><div className="table-wrap mt-6"><table className="data-table"><thead><tr><th>Показатель</th>{data.map((item) => <th key={item.slug}>{item.name_ru}</th>)}</tr></thead><tbody><tr><td>Индекс</td>{data.map((item) => <td key={item.slug} className="font-mono text-xl">{item.score}</td>)}</tr>{(["junior", "middle", "senior"] as const).map((level) => <tr key={level}><td>Медиана {level}</td>{data.map((item) => { const latestDate = item.metrics?.at(-1)?.date; const metric = item.metrics?.find((point) => point.date === latestDate && point.seniority === level); return <td key={item.slug} className="font-mono">{rub(metric?.salary_median)}</td>; })}</tr>)}</tbody></table></div></>
      ) : null}
    </div>
  );
}
