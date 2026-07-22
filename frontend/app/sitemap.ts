import type { MetadataRoute } from "next";
import { safeApi } from "@/lib/api";
import { insights } from "@/lib/insights";
import type { ProfessionSummary } from "@/lib/types";
interface Category { slug: string }
interface Status { last_metric_date?: string; latest_ingestion?: { finished_at?: string; started_at?: string } }
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [professions, categories, status] = await Promise.all([
    safeApi<ProfessionSummary[]>("/professions", []),
    safeApi<Category[]>("/categories", []),
    safeApi<Status>("/status", {}),
  ]);
  const latestIngestion = status.latest_ingestion?.finished_at ?? status.latest_ingestion?.started_at;
  const lastModified = latestIngestion
    ? new Date(latestIngestion)
    : status.last_metric_date
      ? new Date(`${status.last_metric_date}T00:00:00Z`)
      : undefined;
  const staticRoutes = ["", "/professions", "/top", "/research", "/insights", "/data-status", "/salary-benchmarks", "/open-data-daily", "/pricing", "/mentorship", "/support", "/methodology", "/glossary", "/sources", "/citation", "/about"];

  return [
    ...staticRoutes.map((path) => ({
      url: `${base}${path}`,
      changeFrequency: path === "/open-data-daily" ? "daily" as const : "weekly" as const,
      priority: path === "" ? 1 : ["/open-data-daily", "/salary-benchmarks"].includes(path) ? 0.8 : 0.7,
      lastModified,
    })),
    ...categories.map((item) => ({
      url: `${base}/categories/${item.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.75,
      lastModified,
    })),
    ...insights.map((article) => ({
      url: `${base}/insights/${article.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.72,
      lastModified: new Date(`${article.updatedAt}T00:00:00Z`),
    })),
    ...professions.map((item) => ({
      url: `${base}/professions/${item.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
      lastModified,
    })),
  ];
}
