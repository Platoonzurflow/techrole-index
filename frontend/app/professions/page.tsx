import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { ProfessionCard } from "@/components/ProfessionCard";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Каталог IT-профессий",
  description: "50 IT-профессий: зарплаты, вакансии, динамика и уровень достоверности.",
  alternates: { canonical: "/professions" },
};

interface Category { slug: string; name: string; description: string; profession_count: number }

export default async function ProfessionsPage({ searchParams }: { searchParams: Promise<{ category?: string; query?: string }> }) {
  const { category, query } = await searchParams;
  const apiParams = new URLSearchParams();
  if (category) apiParams.set("category", category);
  if (query) apiParams.set("query", query);
  const apiQuery = apiParams.toString();
  const [professions, categories] = await Promise.all([
    safeApi<ProfessionSummary[]>(`/professions${apiQuery ? `?${apiQuery}` : ""}`, []),
    safeApi<Category[]>("/categories", []),
  ]);
  const currentCategory = categories.find((item) => item.slug === category);

  return (
    <div className="shell py-12 lg:py-16">
      <header className="catalog-intro reveal">
        <div>
          <p className="eyebrow flex items-center gap-2"><BriefcaseBusiness size={15} /> Карта IT-рынка</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-[-.035em] sm:text-5xl">
            {query ? `Результаты: ${query}` : currentCategory?.name ?? "Каталог профессий"}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
            Сравнивайте зарплаты, спрос и перспективы без чёрного ящика. Каждая профессия имеет публичную индексируемую страницу, а данные показываются вместе с уровнем достоверности.
          </p>
        </div>
        <div className="min-w-48 border-l-2 border-accent pl-5">
          <strong className="block font-mono text-5xl tracking-tight">{professions.length}</strong>
          <span className="mt-1 block text-sm font-bold text-muted">профессий в выборке</span>
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-positive"><span className="live-dot" /> данные доступны</span>
        </div>
      </header>

      <nav className="scrollbar-none mt-8 flex gap-2 overflow-x-auto pb-3 reveal" style={{ animationDelay: "80ms" }} aria-label="Категории">
        <Link href="/professions" className={`category-chip badge shrink-0 px-4 py-2.5 ${!category ? "border-accent bg-accent/10 text-accent" : "bg-panel"}`}>Все · 50</Link>
        {categories.map((item) => (
          <Link key={item.slug} href={`/professions?category=${item.slug}`} className={`category-chip badge shrink-0 px-4 py-2.5 ${category === item.slug ? "border-accent bg-accent/10 text-accent" : "bg-panel"}`}>
            {item.name} · {item.profession_count}
          </Link>
        ))}
      </nav>

      {professions.length ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {professions.map((item, index) => (
            <div key={item.slug} className="reveal" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
              <ProfessionCard profession={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="panel mt-8 p-12 text-center text-muted">{query ? `По запросу «${query}» ничего не найдено. Попробуйте название профессии из каталога.` : "Каталог пока недоступен. Убедитесь, что backend и seed-контейнер запущены."}</div>
      )}
    </div>
  );
}
