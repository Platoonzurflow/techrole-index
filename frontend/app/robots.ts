import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const allow = ["/", "/professions/", "/categories/", "/top", "/research", "/research.json", "/insights", "/insights/", "/insights.json", "/data-status", "/data-status.json", "/methodology", "/glossary", "/sources", "/citation", "/citation.json", "/citation.bib", "/citation.ris", "/datapackage.json", "/catalog.jsonld", "/about", "/pricing", "/mentorship", "/llms.txt", "/.well-known/llms.txt", "/.well-known/linkset.json", "/llms-full.txt", "/ai-index.json", "/open-data.json", "/open-data.csv", "/open-data-daily", "/open-data-daily.json", "/open-data-daily.csv", "/open-data-daily.csv-metadata.json", "/open-data-daily.schema.json", "/open-data-daily.croissant.json", "/feed.xml"];
  const disallow = ["/api/", "/admin", "/account", "/alerts", "/dashboard", "/compare", "/login", "/register", "/legal/", "/payments/"];

  return {
    rules: [
      { userAgent: "*", allow, disallow },
      { userAgent: ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended"], allow, disallow },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
