import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Layers3, MapPin, Wifi } from "lucide-react";
import { Paywall } from "@/components/Paywall";
import { SalaryBenchmarks } from "@/components/SalaryBenchmarks";
import { HhEmployerDashboard, OfficialSalaryChart, PublicationChart, VacancyChart } from "@/components/Charts";
import { TrendBadge } from "@/components/TrendBadge";
import { ShareActions } from "@/components/ShareActions";
import { api, safeApi } from "@/lib/api";
import { compact, percent } from "@/lib/format";
import { headlineSalaryBenchmarkMaximum } from "@/lib/salary-benchmark-data";
import type {
  MetricPoint,
  ProfessionDetail,
  SalaryBenchmarkCatalogItem,
} from "@/lib/types";

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
    <section id="tech-stack" className="panel tech-stack-section mt-10 p-6 sm:p-8" aria-labelledby="tech-stack-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow">Рабочий инструментарий</p><h2 id="tech-stack-title" className="mt-2 text-2xl font-semibold">Типичный стек профессии</h2><p className="mobile-clamp mt-3 max-w-3xl text-sm leading-6 text-muted">Языки, программы и платформы, которые часто встречаются в задачах этой роли. Конкретный набор зависит от компании и проекта.</p></div>
        <span className="insight-icon"><Layers3 size={19} /></span>
      </div>
      <div className="mobile-card-rail tech-stack-grid mt-6 grid gap-4 md:grid-cols-3">
        {profession.tech_stack.map((group) => (
          <article key={group.title} className="tech-stack-card rounded-2xl border border-line bg-[rgb(var(--panel-rgb)/.55)] p-5">
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

export default async function ProfessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let profession: ProfessionDetail;
  try { profession = await api<ProfessionDetail>(`/professions/${slug}?days=180`); } catch { return <div className="shell py-20"><p className="eyebrow">Профессия</p><h1 className="mt-3 text-3xl font-semibold">Страница временно не загрузилась</h1><p className="mt-3 max-w-xl text-muted">Попробуйте обновить страницу через минуту. Каталог и методология остаются доступны, даже если отдельный срез сейчас пересчитывается.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/professions" className="button-primary">Вернуться в каталог</Link><Link href="/status" className="button-secondary">Проверить статус</Link></div></div>; }
  const salaryBenchmarkCatalog = await safeApi<SalaryBenchmarkCatalogItem[]>(
    "/salary-benchmarks",
    [],
  );
  const salaryBenchmarkMaximum = headlineSalaryBenchmarkMaximum(salaryBenchmarkCatalog);
  const latest = latestByLevel(profession.metrics ?? []);
  const currentVacancies = latest.reduce((sum, item) => sum + item.vacancy_count, 0);
  const weightedSalaryCount = latest.reduce((sum, item) => sum + item.salary_count, 0);
  const weightedVacancies = latest.reduce((sum, item) => sum + item.vacancy_count, 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonicalUrl = `${siteUrl}/professions/${slug}`;
  const stackItems = profession.tech_stack?.flatMap((group) => group.items) ?? [];
  const salaryHistoryUsesCategory = profession.official_open_data?.salary_history.some(
    (item) => item.average != null && item.scope === "category",
  ) ?? false;
  const salaryHistoryUsesMarket = profession.official_open_data?.salary_history.some(
    (item) => item.average != null && item.scope === "market",
  ) ?? false;
  const hhEnrichment = profession.hh_market_data?.hh_enrichment;
  const hhFacetGroups = hhEnrichment ? [
    { title: "Формат работы", items: hhEnrichment.work_formats },
    { title: "Опыт", items: hhEnrichment.experience_levels },
    { title: "График", items: hhEnrichment.work_schedules },
    { title: "Интервалы работы", items: hhEnrichment.working_time_intervals },
    { title: "Режим времени", items: hhEnrichment.working_time_modes },
    { title: "Языки", items: hhEnrichment.languages },
    { title: "Образование", items: hhEnrichment.education_levels },
    { title: "Водительские категории", items: hhEnrichment.driver_license_types },
  ].filter((group) => group.items.length) : [];
  const hasMarketProfile = Boolean(
    hhEnrichment?.top_skills.length
      || hhFacetGroups.length
      || profession.skills?.length
      || profession.regions?.length,
  );
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
      ...(profession.hh_market_data ? [{
        "@type": "Dataset",
        "@id": `${canonicalUrl}#hh-market-data`,
        name: `Наблюдаемый рынок вакансий HH: ${profession.name_ru}`,
        description: profession.hh_market_data.methodology_note,
        url: `${canonicalUrl}#hh-market-data`,
        inLanguage: "ru-RU",
        isAccessibleForFree: true,
        temporalCoverage: `${profession.hh_market_data.date_from}/${profession.hh_market_data.date_to}`,
        spatialCoverage: { "@type": "Country", name: "Россия" },
        creator: { "@type": "Organization", name: "HeadHunter", url: profession.hh_market_data.source_url },
        includedInDataCatalog: { "@id": `${siteUrl}/#catalog` },
        keywords: [profession.name_ru, "вакансии HH", "работодатели", "навыки", ...(hhEnrichment?.top_skills.map((item) => item.name) ?? [])],
        variableMeasured: [{
          "@type": "PropertyValue",
          name: "Классифицировано вакансий",
          value: profession.hh_market_data.total_publications,
        }, {
          "@type": "PropertyValue",
          name: "Вакансий с указанной зарплатой gross",
          value: profession.hh_market_data.salary_gross_count ?? 0,
        }, ...(hhEnrichment?.employer_distribution.map((item) => ({
          "@type": "PropertyValue",
          name: `Вакансии работодателя: ${item.name}`,
          value: item.count,
          unitText: "вакансия",
        })) ?? []), ...(hhEnrichment?.top_skills.map((item) => ({
          "@type": "PropertyValue",
          name: `Вакансии с навыком: ${item.name}`,
          value: item.count,
          unitText: "вакансия",
        })) ?? []), ...profession.hh_market_data.salary_by_seniority
          .filter((item) => item.median != null)
          .map((item) => ({
            "@type": "PropertyValue",
            name: `Медианная gross-зарплата ${levelLabels[item.seniority]}`,
            value: item.median,
            unitText: "RUB в месяц до вычета налогов",
          }))],
        measurementTechnique: "Официальный HH API; поиск по роли и алиасам; дедупликация по vacancy id; правило классификации TechRole Index",
        isBasedOn: profession.hh_market_data.source_url,
        citation: profession.hh_market_data.source_url,
        subjectOf: [
          { "@type": "CreativeWork", name: "Как цитировать TechRole Index", url: `${siteUrl}/citation` },
          { "@type": "CreativeWork", name: "Методология TechRole Index", url: `${siteUrl}/methodology` },
          { "@type": "CreativeWork", name: "Источники TechRole Index", url: `${siteUrl}/sources` },
        ],
      }] : []),
    ],
  };
  return (
    <div className="profession-page shell py-10 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <nav className="profession-breadcrumb flex flex-wrap gap-2 text-sm text-muted" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span>/</span><Link href="/professions">Профессии</Link><span>/</span><span aria-current="page">{profession.name_ru}</span></nav>
      <header className="profession-hero mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><Link href={`/categories/${profession.category_slug}`} className="eyebrow">{profession.category_name}</Link><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{profession.name_ru}</h1><p className="mt-2 text-lg text-muted">{profession.name_en}</p><p className="profession-description mobile-clamp mt-5 max-w-3xl leading-7 text-muted">{profession.description}</p>{profession.hh_market_data ? <a href="#hh-market-data" className="badge mt-4 inline-flex">HH: {profession.hh_market_data.total_publications.toLocaleString("ru-RU")} совпадений</a> : null}</div>
        {profession.score != null ? <div className="profession-score-card panel flex min-w-56 items-center gap-4 p-5"><div className="profession-score-ring grid size-20 place-items-center rounded-full" style={{ background: `radial-gradient(circle, var(--panel) 56%, transparent 58%), conic-gradient(var(--accent) ${profession.score}%, var(--line) 0)` }}><strong className="font-mono text-2xl">{profession.score}</strong></div><div><p className="text-sm text-muted">Индекс из 100</p>{(() => { const badge = confidenceBadge(profession.data_confidence); return <span className={`mt-2 ${badge.className}`}>{badge.label}</span>; })()}</div></div> : null}
      </header>
      <div className="profession-share mt-6"><ShareActions url={canonicalUrl} title={`${profession.name_ru} — TechRole Index`} citation={`TechRole Index. ${profession.name_ru}. ${canonicalUrl}. Дата обновления: ${profession.updated_at ?? "не указана"}.`} /></div>

      <nav className="profession-toc mt-7 flex flex-wrap gap-2" aria-label="Разделы страницы профессии">
        <a href="#tech-stack">Стек</a>
        <a href="#salary-benchmark">Зарплата</a>
        <a href="#official-open-data">Динамика</a>
        {profession.hh_market_data ? <a href="#hh-market-data">HH API</a> : null}
        {!profession.teaser_only && profession.metrics ? <a href="#market-metrics">Расчётный ряд</a> : null}
        <a href="#market-skills">Навыки и регионы</a>
        {!profession.teaser_only && profession.metrics ? <a href="#score-breakdown">Индекс</a> : null}
      </nav>

      <TechStack profession={profession} />

      {profession.salary_benchmark ? (
        <SalaryBenchmarks
          data={profession.salary_benchmark}
          official={profession.official_open_data}
          comparisonMaximum={salaryBenchmarkMaximum}
        />
      ) : null}

      {profession.official_open_data ? (
        <section id="official-open-data" className="market-showcase mt-10 p-5 sm:p-8" aria-labelledby="official-open-data-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Динамика рынка</p>
              <h2 id="official-open-data-title" className="mt-2 text-3xl font-semibold">Зарплата и динамика рынка</h2>
              <p className="mobile-clamp mt-3 max-w-4xl text-sm leading-6 text-muted">{profession.official_open_data.methodology_note}</p>
            </div>
            <a className="button-secondary" href={profession.official_open_data.source_url} rel="noreferrer">Документация источника</a>
          </div>
          <div className="market-showcase-stats compact-stat-grid mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div id="publication-count-exact" className="scroll-mt-24"><p className="text-sm text-muted">Публикации «Работы России»</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.total_publications)}</p></div>
            <div id="publication-count-category" className="scroll-mt-24"><p className="text-sm text-muted">Направление в «Работе России»</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.category_total_publications)}</p></div>
            <div id="salary-disclosed-count" className="scroll-mt-24"><p className="text-sm text-muted">С границей зарплаты</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.salary_disclosed_count)}</p></div>
            <div id="complete-salary-range-count" className="scroll-mt-24"><p className="text-sm text-muted">С полной RUB-вилкой</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.complete_salary_range_count ?? 0)}</p></div>
            <div id="remote-publication-count" className="scroll-mt-24"><p className="text-sm text-muted">С признаком удалённой работы</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.official_open_data.remote_count)}</p></div>
          </div>
          <article id="salary-history" className="market-stage market-stage-primary salary-main-stage mt-7 scroll-mt-24">
            <div className="market-stage-copy">
              <p className="eyebrow">Главный график</p>
              <h3 className="mt-2 text-2xl font-semibold">Как менялась наблюдаемая зарплата</h3>
              <p className="mobile-clamp mt-3 max-w-4xl text-sm leading-6 text-muted">Среднее полной RUB-вилки в скользящем 30-дневном окне с ограничениями. Охват каждого ряда указан в легенде; пунктиром показан статичный ориентир только там, где наблюдений всё ещё недостаточно.</p>
            </div>
            <div className="mt-5"><OfficialSalaryChart data={profession.official_open_data} benchmark={profession.salary_benchmark} maxPeriodDays={profession.history_days ?? 30} /></div>
          </article>
          <div className="market-footnote mt-5 rounded-2xl border border-line/80 bg-[rgb(var(--panel-rgb)/.62)] p-4 text-xs leading-5 text-muted">
            <p>Точное число относится только к публикациям, уверенно классифицированным как «{profession.name_ru}». Данные направления — отдельный устойчивый контекст и не прибавляются к точному числу.</p>
            {salaryHistoryUsesCategory ? <p className="mt-2">В зарплатной динамике хотя бы один уровень использует направление из-за малой точной выборки.</p> : null}
            {salaryHistoryUsesMarket ? <p className="mt-2">Если данных направления тоже недостаточно, уровень показывает общий IT-рынок и подписывает этот охват отдельно.</p> : null}
          </div>
        </section>
      ) : null}

      {profession.hh_market_data ? (
        <section id="hh-market-data" className="market-showcase mt-10 scroll-mt-24 p-5 sm:p-8" aria-labelledby="hh-market-data-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Официальный HH API</p>
              <h2 id="hh-market-data-title" className="mt-2 text-3xl font-semibold">Расширенный снимок вакансий за {profession.hh_market_data.period_days} дней</h2>
              <p className="mobile-clamp mt-3 max-w-4xl text-sm leading-6 text-muted">{profession.hh_market_data.methodology_note}</p>
            </div>
            <a className="button-secondary" href={profession.hh_market_data.source_url} rel="noreferrer">Документация HH API</a>
          </div>
          <div className="market-showcase-stats compact-stat-grid mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div><p className="text-sm text-muted">Совпадения поиска по названию</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.hh_market_data.total_publications)}</p></div>
            <div><p className="text-sm text-muted">По направлению</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.hh_market_data.category_total_publications)}</p></div>
            <div><p className="text-sm text-muted">С зарплатой</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.hh_market_data.salary_disclosed_count)}</p></div>
            <div><p className="text-sm text-muted">Gross</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.hh_market_data.salary_gross_count ?? 0)}</p></div>
            <div><p className="text-sm text-muted">Net</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.hh_market_data.salary_net_count ?? 0)}</p></div>
            <div><p className="text-sm text-muted">Удалённые</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(profession.hh_market_data.remote_count)}</p></div>
          </div>
          {hhEnrichment?.employer_distribution.length ? (
            <article id="top-employers" className="market-stage market-stage-primary mt-7 scroll-mt-24">
              <div className="market-stage-copy flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Карта найма</p>
                  <h3 className="mt-2 text-2xl font-semibold">Кто нанимает {profession.name_ru}</h3>
                  <p className="mobile-clamp mt-3 max-w-3xl text-sm leading-6 text-muted">Пять работодателей с наибольшим числом классифицированных вакансий. Остальные {Math.max(hhEnrichment.distinct_employer_count - 5, 0).toLocaleString("ru-RU")} компаний собраны в одну честную группу «Другие компании».</p>
                </div>
                <div className="flex gap-5 text-right">
                  <span><strong className="block font-mono text-2xl">{hhEnrichment.distinct_employer_count.toLocaleString("ru-RU")}</strong><small className="text-muted">компаний</small></span>
                  <span><strong className="block font-mono text-2xl">{percent(hhEnrichment.enrichment_coverage)}</strong><small className="text-muted">детализация</small></span>
                </div>
              </div>
              <HhEmployerDashboard data={hhEnrichment} />
            </article>
          ) : null}
          <div className="secondary-chart-grid mt-5 grid gap-5 lg:grid-cols-2">
            {profession.history_days === 180 ? (
              <article className="market-stage">
                <div className="market-stage-copy"><p className="eyebrow">Поток публикаций</p><h3 className="mt-2 text-2xl font-semibold">Новые вакансии по неделям</h3><p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Поиск выполнен по названию профессии и алиасам. Совпадения дедуплицированы по идентификатору вакансии.</p></div>
                <div className="mt-5"><PublicationChart data={profession.hh_market_data} minimumExactPublications={5} /></div>
              </article>
            ) : (
              <Paywall compact title="График вакансий за период более 30 дней — в Premium" />
            )}
          </div>
          <div className="market-footnote mt-5 rounded-2xl border border-line/80 bg-[rgb(var(--panel-rgb)/.62)] p-4 text-xs leading-5 text-muted">
            <p>Это официальный поисковый снимок, а не полная копия базы HH. Глубина одной поисковой выдачи ограничена 2 000 результатами. Исходные тексты, контакты и адреса не публикуются; названия работодателей показываются только в агрегированном топ-5, остальные объединены в «Другие компании».</p>
          </div>
        </section>
      ) : null}

      {hasMarketProfile ? (
        <section id="market-skills" className="market-skills-section panel mt-10 scroll-mt-24 p-5 sm:p-8">
          <p className="eyebrow">Рынок</p>
          <h2 className="mt-2 text-3xl font-semibold">Навыки, условия и регионы</h2>
          <p className="mobile-clamp mt-3 max-w-4xl text-sm leading-6 text-muted">
            Здесь собраны повторяющиеся требования из подробных карточек HH и региональный срез этой профессии. Число рядом с признаком показывает, в скольких вакансиях он указан.
          </p>
          {hhEnrichment?.top_skills.length ? (
            <div className="mt-7">
              <h3 className="text-sm font-semibold">Ключевые навыки HH</h3>
              <div className="mobile-chip-rail mt-3 flex flex-wrap gap-2">
                {hhEnrichment.top_skills.map((item) => <span key={item.id} className="badge">{item.name} · {item.count}</span>)}
              </div>
            </div>
          ) : profession.skills?.length ? (
            <div className="mt-7">
              <h3 className="text-sm font-semibold">Упоминания навыков</h3>
              <div className="mobile-chip-rail mt-3 flex flex-wrap gap-2">
                {profession.skills.map((item) => <span key={item.name} className="badge">{item.name} · {item.count}</span>)}
              </div>
            </div>
          ) : null}
          {hhFacetGroups.length ? (
            <div className="hh-facet-grid mt-7">
              {hhFacetGroups.map((group) => (
                <section className="hh-facet-card" key={group.title}>
                  <h3 className="font-semibold">{group.title}</h3>
                  <ul className="hh-facet-list">
                    {group.items.map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.count.toLocaleString("ru-RU")}</strong></li>)}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
          {profession.regions?.length ? (
            <div className="mt-8">
              <h3 className="text-sm font-semibold">Вакансии по регионам</h3>
              <div className="market-region-grid mt-3 grid gap-3 sm:grid-cols-2">
                {profession.regions.map((item) => <div key={item.name} className="flex items-center justify-between border-b border-line pb-3"><span className="flex items-center gap-2"><MapPin size={15} className="text-muted" />{item.name}</span><strong className="font-mono">{item.vacancy_count}</strong></div>)}
              </div>
            </div>
          ) : null}
          {hhEnrichment ? (
            <p className="mobile-clamp mt-7 text-sm leading-7 text-muted">Стажировки: <strong className="text-ink">{hhEnrichment.internship_count.toLocaleString("ru-RU")}</strong> · Ночные смены: <strong className="text-ink">{hhEnrichment.night_shift_count.toLocaleString("ru-RU")}</strong> · Временная работа: <strong className="text-ink">{hhEnrichment.temporary_count.toLocaleString("ru-RU")}</strong> · Трудовой договор: <strong className="text-ink">{hhEnrichment.labor_contract_count.toLocaleString("ru-RU")}</strong> · Нужно сопроводительное письмо: <strong className="text-ink">{hhEnrichment.cover_letter_required_count.toLocaleString("ru-RU")}</strong> · Есть тест: <strong className="text-ink">{hhEnrichment.test_required_count.toLocaleString("ru-RU")}</strong></p>
          ) : null}
        </section>
      ) : null}

      {!profession.teaser_only && profession.metrics ? (
        <>
          <section id="market-metrics" className="mt-10">
            <div className="market-metric-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="panel p-5"><p className="text-sm text-muted">Расчётный объём вакансий</p><p className="mt-2 font-mono text-3xl font-semibold">{compact(currentVacancies)}</p><div className="mt-4"><TrendBadge trend={profession.vacancy_trends?.["7"]} label="7 дней" /></div></article>
              <article className="panel p-5"><p className="text-sm text-muted">Полнота gross-витрины</p><p className="mt-2 font-mono text-3xl font-semibold">{weightedVacancies ? percent(weightedSalaryCount / weightedVacancies) : "-"}</p><p className="mt-4 text-xs text-muted">доля записей с расчётной зарплатой</p></article>
              <article className="panel p-5"><p className="text-sm text-muted">Удалённая работа</p><p className="mt-2 font-mono text-3xl font-semibold">{latest.length ? percent(latest.reduce((sum, item) => sum + item.remote_share, 0) / latest.length) : "-"}</p><p className="mt-4 flex items-center gap-2 text-xs text-muted"><Wifi size={14} /> в расчётном срезе</p></article>
              <article className="panel p-5"><p className="text-sm text-muted">Обновлено</p><p className="mt-2 font-mono text-xl font-semibold">{profession.updated_at ? new Intl.DateTimeFormat("ru-RU").format(new Date(profession.updated_at)) : "-"}</p><p className="mt-4 flex items-center gap-2 text-xs text-muted"><CalendarDays size={14} /> дата подготовленной витрины</p></article>
            </div>
          </section>

          <div className="prepared-chart-grid mt-12 grid gap-5 lg:grid-cols-2">
            <section id="prepared-vacancy-history" className="prepared-chart-panel panel scroll-mt-24 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="eyebrow">Подготовленная модель спроса</p><h2 className="mt-2 text-2xl font-semibold">Расчётный ряд вакансий</h2><p className="mobile-clamp mt-3 max-w-3xl text-sm leading-6 text-muted">Скользящий 30-дневный объём точных HH-вакансий по уровням Junior, Middle и Senior.</p></div>
                <div className="flex gap-2"><TrendBadge trend={profession.vacancy_trends?.["7"]} label="7д" /><TrendBadge trend={profession.vacancy_trends?.["30"]} label="30д" /><TrendBadge trend={profession.vacancy_trends?.["90"]} label="90д" /></div>
              </div>
              {profession.history_days === 180 ? <VacancyChart metrics={profession.metrics} /> : <div className="mt-5"><Paywall compact title="Расширенный ряд вакансий — в Premium" /></div>}
            </section>
          </div>
        </>
      ) : null}

      <ObservationPeriod profession={profession} />

      {profession.teaser_only || !profession.metrics ? <div className="mt-10"><Paywall title={`Метрики «${profession.name_ru}» доступны в Premium`} /></div> : (
        <>
          <section className="score-section mt-12 max-w-3xl">
            <article id="score-breakdown" className="panel p-6">
              <p className="eyebrow">Индекс {profession.scoring_version}</p>
              <h2 className="mt-2 text-2xl font-semibold">За что начислены баллы</h2>
              <p className="mobile-clamp mt-3 text-sm leading-6 text-muted">У каждого фактора есть оценка от 0 до 100 и вес. В версии v1.2.0 спрос, динамика, junior-доступность, удалённость и качество взяты только из HH-вакансий этой профессии; собственная gross RUB-медиана входит при n≥5. Справа показан реальный вклад фактора.</p>
              <div className="score-breakdown-grid mt-6 grid gap-5">
                {Object.entries(profession.score_breakdown ?? {}).map(([key, value]) => {
                  const weight = profession.score_weights?.[key] ?? 0;
                  const contribution = profession.score_contributions?.[key] ?? Math.round(value * weight * 10) / 10;
                  return (
                    <div key={key} className="score-factor">
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span>{breakdownLabels[key] ?? key}</span>
                        <strong className="whitespace-nowrap font-mono">+{contribution} балла</strong>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} /></div>
                      <p className="score-factor-note mt-2 text-xs text-muted">Оценка фактора {value}/100 × вес {Math.round(weight * 100)}%</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 border-t border-line pt-4 text-sm">Итого: <strong className="font-mono">{profession.score} из 100</strong></p>
              <Link href="/methodology" className="mt-6 inline-flex items-center gap-2 font-semibold text-accent">Как считается индекс <ArrowRight size={15} /></Link>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
