import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { insightCanonicalUrl, insightCitationUrls } from "@/lib/insight-citation";
import { getInsight, insights } from "@/lib/insights";

export const dynamicParams = true;

export function generateStaticParams() {
  return insights.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = getInsight((await params).slug);
  if (!article) return { title: "Материал не найден", robots: { index: false } };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = insightCanonicalUrl(article, siteUrl);
  const citation = insightCitationUrls(article, siteUrl);
  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    alternates: {
      canonical: `/insights/${article.slug}`,
      types: {
        "application/vnd.citationstyles.csl+json": citation.csl_json,
        "application/x-bibtex": citation.bibtex,
        "application/x-research-info-systems": citation.ris,
      },
    },
    openGraph: { type: "article", title: article.title, description: article.description, url: `/insights/${article.slug}`, publishedTime: article.publishedAt, modifiedTime: article.updatedAt },
    other: {
      citation_title: article.title,
      citation_author: "TechRole Index",
      citation_publication_date: article.publishedAt,
      citation_fulltext_html_url: canonical,
    },
  };
}

export default async function InsightPage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getInsight((await params).slug);
  if (!article) notFound();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonicalUrl = insightCanonicalUrl(article, siteUrl);
  const citationUrls = insightCitationUrls(article, siteUrl);
  const publicationDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${article.publishedAt}T00:00:00Z`));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": article.kind === "research" ? "Report" : "TechArticle",
        headline: article.title,
        description: article.description,
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        inLanguage: "ru-RU",
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        author: { "@id": `${siteUrl}/#organization` },
        publisher: { "@id": `${siteUrl}/#organization` },
        keywords: article.keywords.join(", "),
        genre: article.kind === "research" ? "Исследование рынка" : "Методический разбор",
        proficiencyLevel: "Beginner",
        citation: article.references.map((reference) => reference.href.startsWith("http") ? reference.href : `${siteUrl}${reference.href}`),
        ...(article.snapshot ? {
          temporalCoverage: article.snapshot.period,
          isBasedOn: `${siteUrl}/open-data-daily`,
          variableMeasured: article.snapshot.metrics.map((metric) => metric.label),
          measurementTechnique: "Агрегация классифицированных публикаций по UTC-дате создания",
        } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Исследования", item: `${siteUrl}/insights` },
          { "@type": "ListItem", position: 3, name: article.title, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <article className="shell py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <nav className="flex flex-wrap gap-2 text-sm text-muted" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span>/</span><Link href="/insights">Исследования</Link><span>/</span><span aria-current="page">{article.kicker}</span></nav>
      <header className="mt-8 max-w-4xl">
        <p className="eyebrow">{article.kicker}</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{article.title}</h1>
        <p className="mt-5 text-xl leading-8 text-muted">{article.description}</p>
        <p className="mt-5 text-sm text-muted"><time dateTime={article.publishedAt}>{publicationDate}</time> · {article.readingMinutes} минут чтения · TechRole Index</p>
      </header>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div className="space-y-10">
          <p className="border-l-4 border-accent pl-5 text-lg leading-8">{article.introduction}</p>
          {article.snapshot ? (
            <section aria-labelledby={`${article.slug}-snapshot`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="eyebrow">Ключевые числа</p><h2 id={`${article.slug}-snapshot`} className="mt-2 text-2xl font-extrabold">Снимок недели</h2></div>
                <p className="text-sm text-muted">{article.snapshot.period.replace("/", " — ")}</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {article.snapshot.metrics.map((metric) => (
                  <article id={metric.id} key={metric.id} className="panel p-5">
                    <p className="text-sm font-bold uppercase tracking-wide text-muted">{metric.label}</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight">{metric.value}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">{metric.detail}</p>
                  </article>
                ))}
              </div>
              <div className="table-wrap mt-5 shadow-none">
                <table className="data-table">
                  <caption className="sr-only">{article.snapshot.table.caption}</caption>
                  <thead><tr>{article.snapshot.table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                  <tbody>{article.snapshot.table.rows.map((row) => <tr key={row.slug}>{row.cells.map((cell, index) => <td key={`${row.slug}-${article.snapshot!.table.columns[index]}`} className={index === 0 ? "font-semibold" : "font-mono"}>{index === 0 ? <Link className="text-accent" href={`/professions/${row.slug}`}>{cell}</Link> : cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">Окно сравнения: {article.snapshot.comparisonPeriod.replace("/", " — ")}. Снимок данных: <time dateTime={article.snapshot.dataModifiedAt}>{article.snapshot.dataModifiedAt}</time>.</p>
            </section>
          ) : null}
          {article.sections.map((section, index) => (
            <section key={section.heading} aria-labelledby={`${article.slug}-section-${index + 1}`}>
              <h2 id={`${article.slug}-section-${index + 1}`} className="text-2xl font-extrabold">{section.heading}</h2>
              <div className="mt-4 space-y-4">{section.paragraphs.map((paragraph) => <p key={paragraph} className="max-w-4xl leading-8 text-muted">{paragraph}</p>)}</div>
            </section>
          ))}
          <section className="panel p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold">Контрольный список</h2>
            <ul className="mt-5 grid gap-3">{article.checklist.map((item) => <li key={item} className="flex gap-3 leading-7"><span aria-hidden="true" className="text-positive">✓</span><span>{item}</span></li>)}</ul>
          </section>
          <section className="rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6">
            <h2 className="text-xl font-extrabold">Как сослаться на материал</h2>
            <p className="mt-3 font-mono text-sm leading-7">TechRole Index. «{article.title}». {publicationDate}. {canonicalUrl}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
              <a className="text-accent" href={citationUrls.csl_json}>CSL-JSON</a>
              <a className="text-accent" href={citationUrls.bibtex}>BibTeX</a>
              <a className="text-accent" href={citationUrls.ris}>RIS</a>
            </div>
          </section>
        </div>

        <aside className="panel p-5 xl:sticky xl:top-24" aria-label="Источники материала">
          <h2 className="font-extrabold">Проверить основание</h2>
          <div className="mt-4 grid gap-3">{article.references.map((reference) => reference.href.startsWith("http") ? <a key={reference.href} href={reference.href} rel="noreferrer" className="text-sm font-semibold text-accent">{reference.label} ↗</a> : <Link key={reference.href} href={reference.href} className="text-sm font-semibold text-accent">{reference.label} →</Link>)}</div>
          <Link href="/insights" className="button-secondary mt-6 w-full">Все исследования</Link>
        </aside>
      </div>
    </article>
  );
}
