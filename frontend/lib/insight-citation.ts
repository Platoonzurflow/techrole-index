import type { InsightArticle } from "@/lib/insights";

export function insightCanonicalUrl(article: InsightArticle, siteUrl: string) {
  return `${siteUrl}/insights/${article.slug}`;
}

export function insightCitationUrls(article: InsightArticle, siteUrl: string) {
  return {
    csl_json: `${siteUrl}/insight-citations/${article.slug}.csl.json`,
    bibtex: `${siteUrl}/insight-citations/${article.slug}.bib`,
    ris: `${siteUrl}/insight-citations/${article.slug}.ris`,
  };
}

export function insightCsl(article: InsightArticle, siteUrl: string) {
  const dateParts = article.publishedAt.split("-").map(Number);
  return {
    type: "webpage",
    id: `techrole-index-insight-${article.slug}`,
    title: article.title,
    author: [{ literal: "TechRole Index" }],
    publisher: "TechRole Index",
    "container-title": "TechRole Index: методические разборы",
    issued: { "date-parts": [dateParts] },
    URL: insightCanonicalUrl(article, siteUrl),
    language: "ru-RU",
    abstract: article.description,
    keyword: article.keywords.join(", "),
  };
}

function bibtex(value: string) {
  return value.replaceAll("\\", "\\textbackslash ").replaceAll("{", "\\{").replaceAll("}", "\\}").replace(/[\r\n]+/g, " ");
}

export function insightBibtex(article: InsightArticle, siteUrl: string) {
  return `@online{techrole_index_${article.slug.replaceAll("-", "_")},
  author = {{TechRole Index}},
  title = {${bibtex(article.title)}},
  year = {${article.publishedAt.slice(0, 4)}},
  date = {${article.publishedAt}},
  url = {${insightCanonicalUrl(article, siteUrl)}},
  note = {${bibtex(article.description)}}
}
`;
}

function ris(value: string) {
  return value.replace(/[\r\n]+/g, " ");
}

export function insightRis(article: InsightArticle, siteUrl: string) {
  return [
    "TY  - ELEC",
    `TI  - ${ris(article.title)}`,
    "AU  - TechRole Index",
    `PY  - ${article.publishedAt.slice(0, 4)}`,
    `DA  - ${article.publishedAt.replaceAll("-", "/")}`,
    `UR  - ${insightCanonicalUrl(article, siteUrl)}`,
    `AB  - ${ris(article.description)}`,
    ...article.keywords.map((keyword) => `KW  - ${ris(keyword)}`),
    "LA  - ru-RU",
    "ER  - ",
    "",
  ].join("\n");
}
