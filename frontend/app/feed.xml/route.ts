import { safeApi } from "@/lib/api";
import { insights } from "@/lib/insights";
import type { ProfessionSummary } from "@/lib/types";

interface OpenDataItem {
  slug: string;
  total_publications: number;
  date_from: string;
  date_to: string;
  last_ingested_at?: string;
}

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [professions, openData] = await Promise.all([
    safeApi<ProfessionSummary[]>("/professions", []),
    safeApi<OpenDataItem[]>("/open-data/publications", []),
  ]);
  const counts = new Map(openData.map((item) => [item.slug, item]));
  const professionItems = professions.map((profession) => {
    const observed = counts.get(profession.slug);
    const description = `${profession.description} Найдено публикаций в официальном открытом API за период ${observed?.date_from ?? "н/д"} - ${observed?.date_to ?? "н/д"}: ${observed?.total_publications ?? 0}.`;
    return `<item><title>${xml(profession.name_ru)}</title><link>${siteUrl}/professions/${profession.slug}</link><guid isPermaLink="true">${siteUrl}/professions/${profession.slug}</guid><description>${xml(description)}</description>${observed?.last_ingested_at ? `<pubDate>${new Date(observed.last_ingested_at).toUTCString()}</pubDate>` : ""}</item>`;
  }).join("");
  const insightItems = insights.map((article) => `<item><title>${xml(article.title)}</title><link>${siteUrl}/insights/${article.slug}</link><guid isPermaLink="true">${siteUrl}/insights/${article.slug}</guid><description>${xml(article.description)}</description><pubDate>${new Date(`${article.publishedAt}T00:00:00Z`).toUTCString()}</pubDate></item>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>TechRole Index - IT-профессии и открытые данные</title><link>${siteUrl}</link><description>Публичные обновления каталога аналитики IT-профессий</description><language>ru-RU</language>${insightItems}${professionItems}</channel></rss>`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
    },
  });
}
