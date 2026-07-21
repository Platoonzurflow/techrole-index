import type { Metadata } from "next";
import Link from "next/link";
import { insights } from "@/lib/insights";

export const metadata: Metadata = {
  title: "Разборы данных и методологии",
  description: "Практические материалы TechRole Index о зарплатных метриках, временных рядах, provenance и воспроизводимом ETL.",
  alternates: { canonical: "/insights" },
};

export default function InsightsPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Разборы TechRole Index",
    url: `${siteUrl}/insights`,
    inLanguage: "ru-RU",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: insights.length,
      itemListElement: insights.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.title,
        url: `${siteUrl}/insights/${article.slug}`,
      })),
    },
  };

  return (
    <div className="shell py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">Редакционные материалы</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">Как читать данные без красивых ошибок</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Шесть самостоятельных разборов объясняют границы показателей, воспроизводимость расчётов и формулировки, которые сохраняют смысл источника.</p>
      <section className="mt-10 grid gap-5 md:grid-cols-2" aria-label="Материалы">
        {insights.map((article) => (
          <article key={article.slug} className="panel flex flex-col p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="eyebrow">{article.kicker}</p><span className="text-xs text-muted">{article.readingMinutes} мин</span></div>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight"><Link href={`/insights/${article.slug}`}>{article.title}</Link></h2>
            <p className="mt-4 flex-1 leading-7 text-muted">{article.description}</p>
            <Link href={`/insights/${article.slug}`} className="mt-6 font-semibold text-accent">Читать разбор →</Link>
          </article>
        ))}
      </section>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/insights.json" className="button-secondary">Машиночитаемый индекс</Link><Link href="/methodology" className="button-secondary">Методология</Link><Link href="/citation" className="button-secondary">Как цитировать</Link></div>
    </div>
  );
}
