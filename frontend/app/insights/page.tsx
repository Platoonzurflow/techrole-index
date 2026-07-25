import type { Metadata } from "next";
import Link from "next/link";
import { insights } from "@/lib/insights";

export const metadata: Metadata = {
  title: "Исследования рынка IT и разборы данных",
  description: "Датированные исследования TechRole Index по открытым данным и практические разборы зарплат, спроса, provenance и методологии.",
  alternates: { canonical: "/insights" },
};

export default function InsightsPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const research = insights.filter((article) => article.kind === "research");
  const guides = insights.filter((article) => article.kind !== "research");
  const formatPublicationDate = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Исследования TechRole Index",
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
      <p className="eyebrow">Собственные данные и выводы</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">Исследования, на которые можно ссылаться</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Датированные срезы с проверяемой арифметикой, прямыми ссылками на данные и готовыми CSL-JSON, BibTeX и RIS. Ниже — методические материалы, которые помогают правильно читать результаты.</p>
      <section className="mt-10" aria-labelledby="latest-research-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Новая публикация</p><h2 id="latest-research-title" className="mt-2 text-2xl font-extrabold">Исследование недели</h2></div><Link href="/feed.xml" className="text-sm font-bold text-accent">RSS обновлений →</Link></div>
        <div className="mt-5 grid gap-5">
          {research.map((article) => (
            <article key={article.slug} className="panel overflow-hidden p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">{article.kicker}</p><span className="text-sm text-muted"><time dateTime={article.publishedAt}>{formatPublicationDate(article.publishedAt)}</time> · {article.readingMinutes} мин</span></div>
              <h3 className="mt-4 max-w-5xl text-3xl font-extrabold leading-tight sm:text-4xl"><Link href={`/insights/${article.slug}`}>{article.title}</Link></h3>
              <p className="mt-5 max-w-4xl text-lg leading-8 text-muted">{article.description}</p>
              <div className="mt-6 flex flex-wrap gap-3"><Link href={`/insights/${article.slug}`} className="button-primary">Открыть исследование</Link><a href={`/insight-citations/${article.slug}.csl.json`} className="button-secondary">Скачать цитату</a></div>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-14" aria-labelledby="guides-title">
        <p className="eyebrow">Методология</p><h2 id="guides-title" className="mt-2 text-3xl font-extrabold">Как проверять и интерпретировать цифры</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2" aria-label="Методические материалы">
        {guides.map((article) => (
          <article key={article.slug} className="panel flex flex-col p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="eyebrow">{article.kicker}</p><span className="text-xs text-muted">{article.readingMinutes} мин</span></div>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight"><Link href={`/insights/${article.slug}`}>{article.title}</Link></h2>
            <p className="mt-4 flex-1 leading-7 text-muted">{article.description}</p>
            <Link href={`/insights/${article.slug}`} className="mt-6 font-semibold text-accent">Читать разбор →</Link>
          </article>
        ))}
        </div>
      </section>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/insights.json" className="button-secondary">Машиночитаемый индекс</Link><Link href="/methodology" className="button-secondary">Методология</Link><Link href="/citation" className="button-secondary">Как цитировать</Link></div>
    </div>
  );
}
