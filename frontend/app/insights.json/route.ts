import { insights } from "@/lib/insights";
import { insightCitationUrls } from "@/lib/insight-citation";
import { conditionalResponse } from "@/lib/conditional-response";

export function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const body = JSON.stringify({
    schema_version: "1.1",
    name: "TechRole Index: методические разборы",
    canonical_url: `${siteUrl}/insights`,
    language: "ru-RU",
    citation_guidance_url: `${siteUrl}/citation`,
    articles: insights.map((article) => ({
      ...article,
      canonical_url: `${siteUrl}/insights/${article.slug}`,
      citation_urls: insightCitationUrls(article, siteUrl),
      references: article.references.map((reference) => ({
        ...reference,
        href: reference.href.startsWith("http") ? reference.href : `${siteUrl}${reference.href}`,
      })),
    })),
  });
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Content-Type": "application/json; charset=utf-8",
      "Link": `<${siteUrl}/insights>; rel="canonical", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, insights.map((item) => item.updatedAt).sort().at(-1));
}
