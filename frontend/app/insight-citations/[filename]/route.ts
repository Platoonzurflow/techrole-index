import {
  insightBibtex,
  insightCanonicalUrl,
  insightCsl,
  insightRis,
} from "@/lib/insight-citation";
import { getInsight, insights } from "@/lib/insights";

const formats = ["csl.json", "bib", "ris"] as const;

export function generateStaticParams() {
  return insights.flatMap((article) => formats.map(
    (format) => ({ filename: `${article.slug}.${format}` }),
  ));
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const filename = (await params).filename;
  const format = formats.find((candidate) => filename.endsWith(`.${candidate}`));
  if (!format) return new Response("Формат не найден\n", { status: 404 });
  const slug = filename.slice(0, -(format.length + 1));
  const article = getInsight(slug);
  if (!article) return new Response("Материал не найден\n", { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = insightCanonicalUrl(article, siteUrl);
  const commonHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Link": `<${canonical}>; rel="canonical", <${siteUrl}/insight-citations/${article.slug}.csl.json>; rel="cite-as"`,
    "X-Robots-Tag": "index, follow, max-snippet:-1",
  };

  if (format === "csl.json") {
    return Response.json(insightCsl(article, siteUrl), {
      headers: {
        ...commonHeaders,
        "Content-Language": "ru-RU",
        "Content-Type": "application/vnd.citationstyles.csl+json; charset=utf-8",
      },
    });
  }
  if (format === "bib") {
    return new Response(insightBibtex(article, siteUrl), {
      headers: {
        ...commonHeaders,
        "Content-Disposition": `inline; filename="techrole-index-${article.slug}.bib"`,
        "Content-Type": "application/x-bibtex; charset=utf-8",
      },
    });
  }
  return new Response(insightRis(article, siteUrl), {
    headers: {
      ...commonHeaders,
      "Content-Disposition": `inline; filename="techrole-index-${article.slug}.ris"`,
      "Content-Type": "application/x-research-info-systems; charset=utf-8",
    },
  });
}
