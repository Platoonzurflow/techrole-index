import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Layers3, MapPin, Radio, Wifi } from "lucide-react";
import { Paywall } from "@/components/Paywall";
import { SalaryBenchmarks } from "@/components/SalaryBenchmarks";
import { OfficialSalaryChart, PublicationChart, SalaryCoverageChart, VacancyChart } from "@/components/Charts";
import { TrendBadge } from "@/components/TrendBadge";
import { ShareActions } from "@/components/ShareActions";
import { api, safeApi } from "@/lib/api";
import { compact, percent } from "@/lib/format";
import type { MetricPoint, ProfessionDetail, ProfessionSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await api<ProfessionDetail>(`/professions/${slug}`);
    return {
      title: `${item.name_ru}: зарплата, спрос и индекс`,
      description: `${item.description} Показатели Junior, Middle и Senior, тренды и размер выборки.`,
      alternates: { canonical: `/professions/${slug}` },
      openGraph: { title: `${item.name_ru} - TechRole Index`, description: item.description, url: `/professions/${slug}` },
    };
  } catch { return { title: "Профессия", robots: { index: false } }; }
}

const levelLabels = { junior: "Junior", middle: "Middle", senior: "Senior" };
const breakdownLabels: Record<string, string> = { demand: "Спрос", salary: "Зарплата", demand_growth: "Рост спроса", junior_access: "Доступность Junior", remote_share: "Удалённая работа", data_quality: "Качество данных" };
const confidenceLabels: Record<string, string> = { insufficient: "недостаточно данных", low: "базовая выборка", medium: "расширенная выборка", high: "крупная выборка" };

function confidenceBadge(level?: string) {
  const normalized = level && ["insufficient", "low", "medium", "high"].includes(level) ? level : "insufficient";
  return { className: `badge confidence-${normalized}`, label: confidenceLabels[normalized] };
}

function latestByLevel(metrics: MetricPoint[]) {
  const latestDate = metrics.at(-1)?.date;
  return (["junior", "middle", "senior"] as const).map((level) => metrics.find((item) => item.date === latestDate && item.seniority === level)).filter(Boolean) as MetricPoint[];
}

function jsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, "\\u003c"); }

function TechStack({ profession }: { profession: ProfessionDetail }) {
  if (!profession.tech_stack?.length) return null;
  return (
    <section id="tech-stack" className="panel mt-10 p-6 sm:p-8" aria-labelledby="tech-stack-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow">Рабочий инструментарий</p><h2 id="tech-stack-title" className="mt-2 text-2xl font-semibold">Типичный стек профессии</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Языки, программы и платформы, которые часто встречаются в задачах этой роли. Конкретный набор зависит от компании и проекта.</p></div>
        <span className="insight-icon"><Layers3 size={19} /></span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {profession.tech_stack.map((group) => (
          <article key={group.title} className="rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5">
            <h3 className="font-semibold">{group.title}</h3>
            <div className="mt-4 flex flex-wrap gap-2">{group.items.map((item) => <span key={item} className="badge">{item}</span>)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ObservationPeriod({ profession }: { profession: ProfessionDetail }) {
  const source = profession.official_open_data;
  if (!source) return null;
  return (
    <section id="observation-period" className="observation-period mt-10 scroll-mt-24" aria-label="Период наблюдения">
      <CalendarDays size={18} aria-hidden="true" />
      <div>
        <p className="text-xs font-bold uppercase tracking-[.13em] text-muted">Период наблюдения</p>
        <p className="mt-1 font-mono font-semibold">{source.date_from} — {source.date_to}</p>
      </div>
      <span className={confidenceBadge(source.confidence_level).className}>{confidenceBadge(source.confidence_level).label}</span>
    </section>
  );
}

function DataLayers({ profession }: { profession: ProfessionDetail }) {
  return (
    <section id="data-layers" className="mt-10 rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.45)] p-5 sm:p-6" aria-labelledby="data-layers-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow">Статус данных</p><h2 id="data-layers-title" className="mt-2 text-2xl font-semibold">Слои, которые нельзя смешивать</h2></div>
        <Link href="/data-status" className="button-secondary">Как читать статусы</Link>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-line p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Официальные публикации</h3>{(() => { const badge = confidenceBadge(profession.official_open_data?.confidence_level); return <span className={badge.className}>{badge.label}</span>; })()}</div>
          <p className="mt-3 text-sm leading-6 text-muted">{profession.official_open_data ? `${profession.official_open_data.total_publications.toLocaleString("ru-RU")} классифицированных публикаций за ${profession.official_open_data.date_from} — ${profession.official_open_data.date_to}. Публикации не равны одновременно активным вакансиям; gross/net не определён.${profession.official_open_data.last_ingested_at ? ` Загрузка: ${profession.official_open_data.last_ingested_at}.` : ""}` : "Для этой роли пока нет классифицированных публикаций официального слоя."}</p>
        </article>
        <article className="rounded-2xl border border-line p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Подготовленная витрина</h3>{(() => { const badge = confidenceBadge(profession.data_confidence); return <span className={badge.className}>{badge.label}</span>; })()}</div>
          <p className="mt-3 text-sm leading-6 text-muted">Показатели спроса, gross-зарплат и индекса рассчитаны в детерминированной витрине{profession.updated_at ? ` на дату ${profession.updated_at}` : ""}. Эта дата не является подтверждением текущего состояния рынка.</p>
        </article>
        <article className="rounded-2xl border border-line p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Публичные зарплатные исследования</h3><span className={confidenceBadge(profession.salary_benchmark?.coverage === "direct" ? "high" : profession.salary_benchmark?.coverage === "related" ? "medium" : "low").className}>{profession.salary_benchmark?.coverage === "direct" ? "точный срез" : profession.salary_benchmark?.coverage === "related" ? "смежный срез" : "ориентир"}</span></div>
          <p className="mt-3 text-sm leading-6 text-muted">Фактические доходы специалистов показаны отдельным справочным слоем: точные, смежные и категорийные значения никогда не смешиваются с вилками вакансий.</p>
        </article>
      </div>
    </section>
  );
}

export default async function ProfessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let profession: ProfessionDetail;
  try { profession = await api<ProfessionDetail>(`/professions/${slug}?days=180`); } catch { return <div className="shell py-20"><p className="eyebrow">Профессия</p><h1 className="mt-3 text-3xl font-semibold">Страница временно не загрузилась</h1><p className="mt-3 max-w-xl text-muted">Попробуйте обновить страницу через минуту. Каталог и методология остаются доступны, даже если отдельный срез сейчас пересчитывается.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/professions" className="button-primary">Вернуться в каталог</Link><Link href="/status" className="button-secondary">Проверить статус</Link></div></div>; }
  const catalog = await safeApi<ProfessionSummary[]>(`/professions?category=${profession.category_slug}`, []);
  const related = catalog.filter((item) => item.slug !== profession.slug).slice(0, 4);
  const latest = latestByLevel(profession.metrics ?? []);
  const currentVacancies = latest.reduce((sum, item) => sum + item.vacancy_count, 0);
  const weightedSalaryCount = latest.reduce((sum, item) => sum + item.salary_count, 0);
  const weightedVacancies = latest.reduce((sum, item) => sum + item.vacancy_count, 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonicalUrl = `${siteUrl}/professions/${slug}`;
  const stackItems = profession.tech_stack?.flatMap((group) => group.items) ?? [];
  const salaryHistoryUsesCategory = profession.official_open_data?.salary_history.some(
    (item) => item.median != null && item.scope === "category",
  ) ?? false;
  const salaryCoverageUsesCategory = (profession.official_open_data?.total_publications ?? 0) < 20;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Профессии", item: `${siteUrl}/professions` },
          { "@type": "ListItem", position: 3, name: profession.name_ru, item: canonicalUrl },
        ],
      },
      {
        "@type": "Occupation",
        "@id": `${canonicalUrl}#occupation`,
        name: profession.name_ru,
        alternateName: profession.name_en,
        description: profession.description,
        occupationalCategory: profession.category_name,
        skills: stackItems.join(", "),
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        inLanguage: "ru-RU",
        sameAs: canonicalUrl,
      },
      ...(profession.salary_benchmark ? [{
        "@type": "Dataset",
        "@id": `${canonicalUrl}#salary-benchmark`,
        name: `Фактические доходы специалистов: ${profession.name_ru}`,
        description: profession.salary_benchmark.methodology_note,
        url: `${canonicalUrl}#salary-benchmark`,
        inLanguage: "ru-RU",
        isAccessibleForFree: true,
        dateModified: profession.updated_at,
        spatialCoverage: { "@type": "Country", name: "Россия" },
        creator: { "@type": "Organization", name: "TechRole Index", url: siteUrl },
        license: `${siteUrl}/citation#reuse`,
        measurementTechnique: "Раздельная публикация точных, технологических, смежных и широких профессиональных срезов без смешивания выборок",
        isBasedOn: profession.salary_benchmark.sources.map((source) => source.url),
        citation: profession.salary_benchmark.sources.map((source) => source.url),
        variableMeasured: profession.salary_benchmark.points
          .filter((point) => !point.is_fallback)
          .map((point) => ({
            "@type": "PropertyValue",
            name: `${point.label}${point.seniority ? ` · ${levelLabels[point.seniority]}` : ""}`,
            value: point.value ?? (point.lower != null && point.upper != null ? `${point.lower}–${point.upper}` : undefined),
            unitText: "RUB в месяц",
            description: `${point.metric}; ${point.scope}; ${point.geography}${point.sample_size != null ? `; n=${point.sample_size}` : ""}`,
          })),
        subjectOf: [
          { "@type": "CreativeWork", name: "Методология TechRole Index", url: `${siteUrl}/methodology` },
          { "@type": "CreativeWork", name: "Как цитировать TechRole Index", url: `${siteUrl}/citation` },
        ],
        distribution: [
          { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${siteUrl}/salary-benchmarks.json` },
          { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${siteUrl}/salary-benchmarks.csv` },
        ],
      }] : []),
      ...(profession.official_open_data ? [{
        "@type": "Dataset",
        "@id": `${canonicalUrl}#official-open-data`,
        name: `Публикации вакансий ${profession.name_ru} в официальном открытом API`,
        description: profession.official_open_data.methodology_note,
        url: `${canonicalUrl}#official-open-data`,
        inLanguage: "ru-RU",
        isAccessibleForFree: true,
        temporalCoverage: `${profession.official_open_data.date_from}/${profession.official_open_data.date_to}`,
        spatialCoverage: { "@type": "Place", name: "Россия" },
        creator: { "@type": "GovernmentOrganization", name: "Работа России", url: profession.official_open_data.source_url },
        includedInDataCatalog: { "@id": `${siteUrl}/#catalog` },
        variableMeasured: [{
          "@type": "PropertyValue",
          name: "Найдено публикаций вакансий",
          value: profession.official_open_data.total_publications,
        }, ...profession.official_open_data.salary_by_seniority
          .filter((item) => item.median != null)
          .map((item) => ({
            "@type": "PropertyValue",
            name: `Медианная зарплата ${levelLabels[item.seniority]}`,
            value: item.median,
            unitText: "RUB в месяц, gross/net не определён",
          }))],
        measurementTechnique: "Классификация заголовков вакансий по словарю алиасов, регулярным и исключающим правилам",
        subjectOf: [
          { "@type": "CreativeWork", name: "Как цитировать TechRole Index", url: `${siteUrl}/citation` },
          { "@type": "CreativeWork", name: "Методология TechRole Index", url: `${siteUrl}/methodology` },
          { "@type": "CreativeWork", name: "Источники TechRole Index", url: `${siteUrl}/sources` },
        ],
        distribution: [
          { "@type": "DataDownload", encodingFormat: "application/ld+json", contentUrl: `${siteUrl}/open-data.json#${profession.slug}` },
          { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${siteUrl}/open-data.csv` },
          { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${siteUrl}/open-data-daily.json` },
        ],
      }] : []),
    ],
  };
  return (
    <div className="profession-page shell py-10 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <nav className="flex flex-wrap gap-2 text-sm text-muted" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span>/</span><Link href="/professions">Профессии</Link><span>/</span><span aria-current="page">{profession.name_ru}</span></nav>
      <header className="profession-hero mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><Link href={`/categories/${profession.category_slug}`} className="eyebrow">{profession.category_name}</Link><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{profession.name_ru}</h1><p className="mt-2 text-lg text-muted">{profession.name_en}</p><p className="mt-5 max-w-3xl leading-7 text-muted">{profession.description}</p></div>
        {profession.score != null ? <div className="panel flex min-w-56 items-center gap-4 p-5"><div className="grid size-20 place-items-center rounded-full" style={{ background: `radial-gradient(circle, var(--panel) 56%, transparent 58%), conic-gradient(var(--accent) ${profession.score}%, var(--line) 0)` }}><strong className="font-mono text-2xl">{profession.score}</strong></div><div><p className="text-sm text-muted">Индекс из 100</p>{(() => { const badge = confidenceBadge(profession.data_confidence); return <span className={`mt-2 ${badge.className}`}>{badge.label}</span>; })()}</div></div> : null}
      </header>
      <div className="mt-6"><ShareActions url={canonicalUrl} title={`${profession.name_ru} — TechRole Index`} citation={`TechRole Index. ${profession.name_ru}. ${canonicalUrl}. Дата обновления: ${profession.updated_at ?? "не указана"}.`} /></div>

      <nav className="profession-toc mt-7 flex flex-wrap gap-2" aria-label="Разделы страницы профессии">
        <a href="#tech-stack">Стек</a>
        <a href="#salary-benchmark">Зарплата</a>
        <a href="#official-open-data">Динамика</a>
        {!profession.teaser_only && profession.metrics ? <a href="#market-metrics">Расчётный ряд</a> : null}
        <a href="#data-layers">Источники</a>
        {!profession.teaser_only && profession.metrics ? <><a href="#score-breakdown">Индекс</a><a href="#market-skills">Навыки и регионы</a></> : null}
      </nav>

      <TechStack profession={profession} />

      {profession.salary_benchmark ? <SalaryBenchmarks data={profession.salary_benchmark} official={profession.official_open_data} /> : null}

      {profession.official_open_data ? (
        <section id="official-open-data" className="market-showcase mt-10 p-5 sm:p-8" aria-labelledby="official-open-data-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Динамика рынка</p>
              <h2 id="official-open-data-title" className="mt-2 text-3xl font-semibold">Зарплата и поток вакансий за 180 дней</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">{profession.official_open_data.methodology_note}</p>
            </div>
            <a className="button-secondary" href={profession.official_open_data.source_url} rel="noreferrer">Документация источника</a>
          </div>
          <div className="market-showcase-stats mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div id="publication-count-exact" className="scroll-mt-24"><p className="text-sm text-muted">Точно по профессии</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.total_publications)}</p></div>
            <div id="publication-count-category" className="scroll-mt-24"><p className="text-sm text-muted">По направлению «{profession.category_name}»</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.category_total_publications)}</p></div>
            <div id="salary-disclosed-count" className="scroll-mt-24"><p className="text-sm text-muted">С границей зарплаты</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.salary_disclosed_count)}</p></div>
            <div id="complete-salary-range-count" className="scroll-mt-24"><p className="text-sm text-muted">С полной RUB-вилкой</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.complete_salary_range_count ?? 0)}</p></div>
            <div id="remote-publication-count" className="scroll-mt-24"><p className="text-sm text-muted">С признаком удалённой работы</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.remote_count)}</p></div>
          </div>
          <article id="salary-history" className="market-stage market-stage-primary mt-7 scroll-mt-24">
            <div className="market-stage-copy">
              <p className="eyebrow">Главный график</p>
              <h3 className="mt-2 text-2xl font-semibold">Как менялась наблюдаемая зарплата</h3>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Накопительная медиана полных RUB-вилок. Для каждого уровня сначала берётся точная профессия; при выборке меньше {profession.official_open_data.salary_min_sample} используется явно подписанное направление «{profession.category_name}». Статичный ориентир показан пунктиром и не выдаётся за динамику.</p>
            </div>
            <div className="mt-5"><OfficialSalaryChart data={profession.official_open_data} benchmark={profession.salary_benchmark} /></div>
          </article>
          <article id="publication-history" className="market-stage mt-5 scroll-mt-24">
            <div className="market-stage-copy">
              <p className="eyebrow">Интенсивность рынка</p>
              <h3 className="mt-2 text-2xl font-semibold">Новые публикации по неделям</h3>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Если точный ряд слишком редкий, график автоматически показывает направление и подписывает выбранный охват. Публикации за период не равны числу вакансий, одновременно активных сегодня.</p>
            </div>
            <div className="mt-5"><PublicationChart data={profession.official_open_data} /></div>
          </article>
          <article id="salary-coverage" className="market-stage mt-5 scroll-mt-24">
            <div className="market-stage-copy">
              <p className="eyebrow">Качество зарплатных данных</p>
              <h3 className="mt-2 text-2xl font-semibold">Полнота вилок для медианы</h3>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Столбцы показывают новые публикации и записи с обеими границами зарплаты в RUB; линия — долю полных вилок. В медиану входят только полные вилки с распознанным уровнем.{salaryCoverageUsesCategory ? ` Для устойчивости показано направление «${profession.category_name}»: точных публикаций профессии меньше 20.` : " Здесь показан точный срез профессии."}</p>
            </div>
            <div className="mt-5" data-testid="salary-coverage-visualization"><SalaryCoverageChart data={profession.official_open_data} /></div>
          </article>
          <div className="mt-5 rounded-2xl border border-line/80 bg-[rgb(var(--panel-rgb)/.62)] p-4 text-xs leading-5 text-muted">
            <p>Точное число относится только к публикациям, уверенно классифицированным как «{profession.name_ru}». Данные направления — отдельный устойчивый контекст и не прибавляются к точному числу.</p>
            {salaryHistoryUsesCategory ? <p className="mt-2">В зарплатной динамике хотя бы один уровень использует направление из-за малой точной выборки.</p> : null}
          </div>
        </section>
      ) : null}

      {!profession.teaser_only && profession.metrics ? (
        <>
          <section id="market-metrics" className="mt-10">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="panel p-5"><p className="text-sm text-muted">Расчётный объём вакансий</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(currentVacancies)}</p><div className="mt-4"><TrendBadge trend={profession.vacancy_trends?.["7"]} label="7 дней" /></div></article>
              <article className="panel p-5"><p className="text-sm text-muted">Полнота gross-витрины</p><p className="mt-2 font-mono text-3xl font-semibold">{weightedVacancies ? percent(weightedSalaryCount / weightedVacancies) : "-"}</p><p className="mt-4 text-xs text-muted">доля записей с расчётной зарплатой</p></article>
              <article className="panel p-5"><p className="text-sm text-muted">Удалённая работа</p><p className="mt-2 font-mono text-3xl font-semibold">{latest.length ? percent(latest.reduce((sum, item) => sum + item.remote_share, 0) / latest.length) : "-"}</p><p className="mt-4 flex items-center gap-2 text-xs text-muted"><Wifi size={14} /> в расчётном срезе</p></article>
              <article className="panel p-5"><p className="text-sm text-muted">Обновлено</p><p className="mt-2 font-mono text-xl font-semibold">{profession.updated_at ? new Intl.DateTimeFormat("ru-RU").format(new Date(profession.updated_at)) : "-"}</p><p className="mt-4 flex items-center gap-2 text-xs text-muted"><CalendarDays size={14} /> дата подготовленной витрины</p></article>
            </div>
          </section>

          <section id="prepared-vacancy-history" className="panel mt-12 scroll-mt-24 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Подготовленная модель спроса</p><h2 className="mt-2 text-2xl font-semibold">Расчётный ряд вакансий</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Сопоставимый ряд Junior, Middle и Senior внутри подготовленной витрины. Для наблюдаемой зарплатной динамики используйте единый официальный график выше.</p></div><div className="flex gap-2"><TrendBadge trend={profession.vacancy_trends?.["7"]} label="7д" /><TrendBadge trend={profession.vacancy_trends?.["30"]} label="30д" /><TrendBadge trend={profession.vacancy_trends?.["90"]} label="90д" /></div></div><VacancyChart metrics={profession.metrics} /></section>
        </>
      ) : null}

      <ObservationPeriod profession={profession} />
      <DataLayers profession={profession} />

      {profession.teaser_only || !profession.metrics ? <div className="mt-10"><Paywall title={`Метрики «${profession.name_ru}» доступны в Premium`} /></div> : (
        <>
          <section className="mt-12 grid gap-5 lg:grid-cols-2">
            <article id="score-breakdown" className="panel p-6">
              <p className="eyebrow">Индекс {profession.scoring_version}</p>
              <h2 className="mt-2 text-2xl font-semibold">За что начислены баллы</h2>
              <p className="mt-3 text-sm leading-6 text-muted">У каждого фактора есть оценка от 0 до 100 и вес. Справа показан его реальный вклад в итоговый индекс.</p>
              <div className="mt-6 grid gap-5">
                {Object.entries(profession.score_breakdown ?? {}).map(([key, value]) => {
                  const weight = profession.score_weights?.[key] ?? 0;
                  const contribution = profession.score_contributions?.[key] ?? Math.round(value * weight * 10) / 10;
                  return (
                    <div key={key}>
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span>{breakdownLabels[key] ?? key}</span>
                        <strong className="whitespace-nowrap font-mono">+{contribution} балла</strong>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} /></div>
                      <p className="mt-2 text-xs text-muted">Оценка фактора {value}/100 × вес {Math.round(weight * 100)}%</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 border-t border-line pt-4 text-sm">Итого: <strong className="font-mono">{profession.score} из 100</strong></p>
              <Link href="/methodology" className="mt-6 inline-flex items-center gap-2 font-semibold text-accent">Как считается индекс <ArrowRight size={15} /></Link>
            </article>
            <article id="market-skills" className="panel p-6">
              <p className="eyebrow">Рынок</p>
              <h2 className="mt-2 text-2xl font-semibold">Навыки и регионы</h2>
              <p className="mt-3 text-sm leading-6 text-muted">Число рядом с навыком — в скольких записях подготовленной витрины этой профессии он указан. Число рядом с регионом — расчётный объём последнего подготовленного среза. Это не рейтинг навыков и не текущий остаток вакансий в регионе.</p>
              <h3 className="mt-6 text-sm font-semibold">Упоминания навыков</h3>
              <div className="mt-3 flex flex-wrap gap-2">{profession.skills?.map((item) => <span key={item.name} className="badge">{item.name} · {item.count}</span>)}</div>
              <h3 className="mt-8 text-sm font-semibold">Расчётный объём по регионам</h3>
              <div className="mt-3 grid gap-3">{profession.regions?.map((item) => <div key={item.name} className="flex items-center justify-between border-b border-line pb-3"><span className="flex items-center gap-2"><MapPin size={15} className="text-muted" />{item.name}</span><strong className="font-mono">{item.vacancy_count}</strong></div>)}</div>
            </article>
          </section>
          {profession.history_days === 30 ? <div className="mt-10"><Paywall compact title="Графики за период более 30 дней - в Premium" /></div> : null}
        </>
      )}

      {related.length ? <section id="related-professions" className="mt-14 scroll-mt-24"><p className="eyebrow">Смежные роли</p><h2 className="mt-2 text-2xl font-semibold">Продолжить исследование</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{related.map((item) => <Link key={item.slug} href={`/professions/${item.slug}`} className="panel flex items-center justify-between p-4 font-semibold hover:border-accent/50"><span>{item.name_ru}</span><ArrowRight size={16} className="text-muted" /></Link>)}</div></section> : null}
      <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted"><span className="flex items-center gap-2"><Radio size={15} /> Данные обновлены {profession.updated_at ?? "-"}; размер выборки показан для каждого уровня.</span><Link href="/citation" className="button-secondary">Как цитировать</Link>{profession.history_days === 180 ? <a href={`/api/v1/export/professions/${profession.slug}.csv`} className="button-secondary">Скачать CSV</a> : null}</div>
    </div>
  );
}
