"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HhEmployerDashboard } from "@/components/Charts";
import { percent } from "@/lib/format";
import type { OpenDataCatalogItem } from "@/lib/types";

export function CompaniesExplorer({ items }: { items: OpenDataCatalogItem[] }) {
  const available = useMemo(() => items
    .filter((item) => item.hh_market_data?.hh_enrichment?.employer_distribution.length)
    .sort((left, right) => (
      (right.hh_market_data?.hh_enrichment?.employer_vacancy_count ?? 0)
      - (left.hh_market_data?.hh_enrichment?.employer_vacancy_count ?? 0)
    )), [items]);
  const [slug, setSlug] = useState(available[0]?.slug ?? "");
  const selected = available.find((item) => item.slug === slug) ?? available[0];
  const hh = selected?.hh_market_data;
  const enrichment = hh?.hh_enrichment;

  if (!selected || !hh || !enrichment) {
    return <div className="panel p-6 text-muted">Подробные карточки HH ещё обрабатываются. Дашборд заполнится автоматически.</div>;
  }
  return (
    <section className="market-showcase p-5 sm:p-8" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Интерактивный срез</p>
          <h2 className="mt-2 text-3xl font-semibold">{selected.name_ru}</h2>
          <p className="mt-2 text-sm text-muted">{hh.date_from} — {hh.date_to} · официальный поисковый снимок HH API</p>
        </div>
        <label className="grid min-w-[min(100%,22rem)] gap-2 text-sm font-semibold">
          Профессия
          <select className="field" value={selected.slug} onChange={(event) => setSlug(event.target.value)}>
            {available.map((item) => <option key={item.slug} value={item.slug}>{item.name_ru}</option>)}
          </select>
        </label>
      </div>
      <div className="market-showcase-stats mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-sm text-muted">Вакансий с работодателем</p><p className="mt-2 font-mono text-3xl font-semibold">{enrichment.employer_vacancy_count.toLocaleString("ru-RU")}</p></div>
        <div><p className="text-sm text-muted">Разных компаний</p><p className="mt-2 font-mono text-3xl font-semibold">{enrichment.distinct_employer_count.toLocaleString("ru-RU")}</p></div>
        <div><p className="text-sm text-muted">Подробных карточек</p><p className="mt-2 font-mono text-3xl font-semibold">{enrichment.enriched_vacancy_count.toLocaleString("ru-RU")}</p></div>
        <div><p className="text-sm text-muted">Покрытие деталей</p><p className="mt-2 font-mono text-3xl font-semibold">{percent(enrichment.enrichment_coverage)}</p></div>
      </div>
      <article className="market-stage market-stage-primary mt-7">
        <div className="market-stage-copy">
          <p className="eyebrow">Топ-5 + длинный хвост</p>
          <h3 className="mt-2 text-2xl font-semibold">Компании с наибольшим числом вакансий</h3>
          <p className="mt-3 text-sm leading-6 text-muted">Пять компаний показаны отдельно, все остальные объединены в «Другие компании». Так диаграмма остаётся читаемой и не превращается в публикацию полного списка работодателей.</p>
        </div>
        <HhEmployerDashboard data={enrichment} />
      </article>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="button-primary" href={`/professions/${selected.slug}#top-employers`}>Открыть профессию</Link>
        <a className="button-secondary" href="/hh-market-enrichment.json">JSON</a>
        <a className="button-secondary" href="/hh-market-enrichment.csv">CSV</a>
      </div>
    </section>
  );
}
