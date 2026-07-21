import { insightBibtex, insightCanonicalUrl } from "@/lib/insight-citation";
import { getInsight } from "@/lib/insights";

export const dynamicParams = true;

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const article = getInsight((await params).slug);
  if (!article) return new Response("Материал не найден\n", { status: 404 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = insightCanonicalUrl(article, siteUrl);
  return new Response(insightBibtex(article, siteUrl), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Disposition": `inline; filename="techrole-index-${article.slug}.bib"`,
      "Content-Type": "application/x-bibtex; charset=utf-8",
      "Link": `<${canonical}>; rel="canonical", <${canonical}/cite/csl-json>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
