import Link from "next/link";
import { ArrowRight, Database, Gauge, GitCompareArrows, Search } from "lucide-react";
import { CareerTransformationHero } from "@/components/CareerTransformationHero";
import { ProfessionCard } from "@/components/ProfessionCard";
import { TrendBadge } from "@/components/TrendBadge";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const signals = [
  "50 профессий",
  "Junior · Middle · Senior",
  "Динамика за 180 дней",
  "Медиана и P25-P75",
  "Спрос и удалёнка",
  "Стек каждой роли",
];

const quickDirections = [
  ["Разработка", "development"],
  ["Data & AI", "data-ai"],
  ["Аналитика", "analytics"],
  ["Инфраструктура", "infrastructure"],
];

export default async function HomePage() {
  const [professions, ranking] = await Promise.all([
    safeApi<ProfessionSummary[]>("/professions", []),
    safeApi<ProfessionSummary[]>("/ranking", []),
  ]);
  const featured = professions.filter((item) => !item.teaser_only).slice(0, 6);

  return (
    <>
      <section className="cinematic-hero">
        <div className="cinematic-glow cinematic-glow-one" aria-hidden="true" />
        <div className="cinematic-glow cinematic-glow-two" aria-hidden="true" />
        <div className="shell cinematic-grid">
          <div className="cinematic-copy reveal">
            <div className="flex flex-wrap items-center gap-3">
              <span className="cinematic-eyebrow"><Database size={15} /> Аналитика рынка IT-профессий</span>
              <span className="cinematic-status"><span className="live-dot" /> Расчёты по расписанию</span>
            </div>
            <h1>Сравните IT-профессии. <span>Выберите направление по данным.</span></h1>
            <p>TechRole Index показывает зарплаты Junior, Middle и Senior, количество вакансий, недельную динамику и востребованный стек. Сервис помогает понять, какое направление подходит именно для вашего следующего карьерного шага.</p>

            <form className="career-search" action="/professions" method="get" role="search">
              <Search size={22} aria-hidden="true" />
              <label className="sr-only" htmlFor="career-query">Название профессии</label>
              <input id="career-query" name="query" type="search" placeholder="Например: Python-разработчик" maxLength={120} />
              <button type="submit">Найти профессию</button>
            </form>

            <div className="quick-directions" aria-label="Быстрый выбор направления">
              <span>Популярное:</span>
              {quickDirections.map(([label, slug]) => <Link key={slug} href={`/professions?category=${slug}`}>{label}</Link>)}
            </div>

            <div className="cinematic-stats">
              {[["50", "профессий"], ["180", "дней наблюдений"], ["3", "уровня опыта"]].map(([value, label]) => (
                <div key={label}><strong>{value}</strong><span>{label}</span></div>
              ))}
            </div>
          </div>
          <div className="reveal" style={{ animationDelay: "120ms" }}><CareerTransformationHero /></div>
        </div>
      </section>

      <div className="signal-strip" aria-label="Возможности сервиса">
        <div className="signal-track" aria-hidden="true">
          {[...signals, ...signals].map((item, index) => <span key={`${item}-${index}`} className="signal-item">{item}</span>)}
        </div>
      </div>

      <section className="market-pulse-section">
        <div className="shell market-pulse-grid">
          <div className="market-pulse-copy reveal">
            <p className="eyebrow">Рынок сейчас</p>
            <h2>Кто растёт за неделю</h2>
            <p>Сравниваем среднее число вакансий за последние семь дней с предыдущей неделей. Стрелка показывает направление, процент - силу изменения.</p>
            <Link href="/top" className="button-primary">Открыть полный рейтинг <ArrowRight className="ml-2" size={17} /></Link>
          </div>
          <ol className="market-leaders reveal" aria-label="Лидеры рейтинга" style={{ animationDelay: "100ms" }}>
            {ranking.length ? ranking.map((item, index) => (
              <li key={item.slug}>
                <span className="leader-position">{String(index + 1).padStart(2, "0")}</span>
                <div className="leader-name"><Link href={`/professions/${item.slug}`}>{item.name_ru}</Link><span>{item.category_name}</span></div>
                <TrendBadge trend={{ period_days: 7, change_percent: item.weekly_change_percent, direction: item.weekly_direction ?? "unknown" }} />
                <strong>{item.score ?? "-"}</strong>
              </li>
            )) : <li className="justify-center text-muted">Рейтинг появится после загрузки данных.</li>}
          </ol>
        </div>
      </section>

      <section className="job-catalog-section">
        <div className="shell">
          <div className="job-section-heading reveal">
            <div><p className="eyebrow">Подбор направления</p><h2>Популярные IT-профессии</h2><p>Карточки устроены как краткая вакансия: роль, направление, индекс рынка и доступ к подробной аналитике.</p></div>
            <Link href="/professions" className="button-secondary">Все 50 профессий</Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((item, index) => <div key={item.slug} className="reveal" style={{ animationDelay: `${Math.min(index, 5) * 70}ms` }}><ProfessionCard profession={item} /></div>)}
          </div>
        </div>
      </section>

      <section className="trust-section shell">
        <div className="trust-heading reveal"><p className="eyebrow">Без чёрного ящика</p><h2>Сначала основание. Потом вывод.</h2><p>Каждый показатель сопровождается периодом, размером выборки и открытым объяснением расчёта.</p></div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            [Database, "Честная статистика", "Медиана, среднее, P25/P75 и coverage считаются отдельно. Отсутствующие границы зарплаты не дорисовываются."],
            [Gauge, "Объяснимый индекс", "Шесть компонентов с открытыми весами, percentile rank и версией формулы. Результат можно разобрать по частям."],
            [GitCompareArrows, "Сравнение по делу", "Сопоставьте несколько направлений по зарплатам, спросу и динамике, чтобы увидеть разницу на одном экране."],
          ].map(([Icon, title, copy], index) => {
            const ItemIcon = Icon as typeof Database;
            return <article key={String(title)} className="insight-card reveal" style={{ animationDelay: `${80 + index * 90}ms` }}><div className="flex items-start justify-between gap-4"><span className="insight-icon"><ItemIcon size={19} /></span><span className="insight-number">0{index + 1}</span></div><h3 className="mt-6 text-xl font-extrabold">{String(title)}</h3><p className="mt-3 leading-7 text-muted">{String(copy)}</p></article>;
          })}
        </div>
      </section>
    </>
  );
}
