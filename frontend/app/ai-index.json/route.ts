import { safeApi } from "@/lib/api";
import { insightCitationUrls } from "@/lib/insight-citation";
import { insights } from "@/lib/insights";
import type { DataProvenance, OfficialSalarySlice, ProfessionSummary } from "@/lib/types";

interface Source {
  code: string;
  name: string;
  enabled: boolean;
  terms_url?: string;
}

interface OpenDataItem {
  slug: string;
  period_days: number;
  date_from: string;
  date_to: string;
  total_publications: number;
  last_ingested_at?: string;
  salary_currency: string;
  salary_gross_status: "unknown";
  salary_min_sample: number;
  salary_by_seniority: OfficialSalarySlice[];
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [professions, sources, openData, provenance] = await Promise.all([
    safeApi<ProfessionSummary[]>("/professions", []),
    safeApi<Source[]>("/sources", []),
    safeApi<OpenDataItem[]>("/open-data/publications", []),
    safeApi<DataProvenance | null>("/data-provenance", null),
  ]);
  const openDataBySlug = new Map(openData.map((item) => [item.slug, item]));
  return Response.json({
    schema_version: "1.1",
    name: "TechRole Index",
    canonical_url: siteUrl,
    language: "ru-RU",
    description: "Проверяемая аналитика спроса, зарплат и динамики IT-профессий.",
    methodology_url: `${siteUrl}/methodology`,
    glossary_url: `${siteUrl}/glossary`,
    sources_url: `${siteUrl}/sources`,
    editorial_policy_url: `${siteUrl}/about`,
    citation_guidance_url: `${siteUrl}/citation`,
    citation_formats: {
      csl_json: `${siteUrl}/citation.json`,
      bibtex: `${siteUrl}/citation.bib`,
      ris: `${siteUrl}/citation.ris`,
      data_package: `${siteUrl}/datapackage.json`,
      dcat_catalog: `${siteUrl}/catalog.jsonld`,
    },
    official_open_data_url: `${siteUrl}/open-data.json`,
    official_open_data_csv_url: `${siteUrl}/open-data.csv`,
    observed_publication_daily_url: `${siteUrl}/open-data-daily.json`,
    observed_publication_daily_csv_url: `${siteUrl}/open-data-daily.csv`,
    observed_publication_daily_csvw_url: `${siteUrl}/open-data-daily.csv-metadata.json`,
    observed_publication_daily_schema_url: `${siteUrl}/open-data-daily.schema.json`,
    observed_publication_daily_croissant_url: `${siteUrl}/open-data-daily.croissant.json`,
    observed_publication_daily_page_url: `${siteUrl}/open-data-daily`,
    observed_publication_linkset_url: `${siteUrl}/.well-known/linkset.json`,
    dcat_catalog_url: `${siteUrl}/catalog.jsonld`,
    data_status_url: `${siteUrl}/data-status`,
    data_provenance_url: `${siteUrl}/data-status.json`,
    data_layers: provenance?.layers ?? [],
    update_feed_url: `${siteUrl}/feed.xml`,
    research_report_url: `${siteUrl}/research`,
    research_data_url: `${siteUrl}/research.json`,
    editorial_insights_url: `${siteUrl}/insights`,
    editorial_insights_data_url: `${siteUrl}/insights.json`,
    editorial_insights: insights.map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      canonical_url: `${siteUrl}/insights/${article.slug}`,
      citation_urls: insightCitationUrls(article, siteUrl),
      date_modified: article.updatedAt,
    })),
    interpretation_rules: {
      insufficient_data_is_not_zero: true,
      official_salary_basis: "midpoint_of_complete_rub_ranges",
      official_salary_tax_status: "unknown",
      trend_7d: "current 7-day average compared with preceding 7-day average",
      score_0_100: "versioned comparative index, not an employment or salary promise",
      prepared_metric_date_is_live_market_claim: false,
    },
    entities: professions.map((item) => {
      const observed = openDataBySlug.get(item.slug);
      return {
        type: "Occupation",
        slug: item.slug,
        name_ru: item.name_ru,
        name_en: item.name_en,
        category: item.category_name,
        description: item.description,
        canonical_url: `${siteUrl}/professions/${item.slug}`,
        public_statistics_available: !item.teaser_only,
        prepared_analytics: {
          status: "prepared_baseline",
          salary_tax_status: "gross",
          current_market_claim: false,
        },
        official_publications: observed ? {
          source: "Работа России",
          period_days: observed.period_days,
          date_from: observed.date_from,
          date_to: observed.date_to,
          count: observed.total_publications,
          last_ingested_at: observed.last_ingested_at ?? null,
          interpretation: "Публикации по дате создания записи, не число одновременно активных вакансий",
          official_salary: {
            currency: observed.salary_currency,
            gross_status: observed.salary_gross_status,
            minimum_sample: observed.salary_min_sample,
            methodology: "Midpoint только полных RUB-вилок; недостаточная выборка не превращается в ноль",
            levels: observed.salary_by_seniority.map((slice) => ({
              seniority: slice.seniority,
              status: slice.median == null ? "insufficient_data" : "available",
              median: slice.median ?? null,
              average: slice.average ?? null,
              p25: slice.p25 ?? null,
              p75: slice.p75 ?? null,
              sample_size: slice.sample_size,
              salary_disclosed_count: slice.salary_count,
              vacancy_count: slice.vacancy_count,
            })),
          },
        } : null,
      };
    }),
    sources: sources.map((source) => ({
      code: source.code,
      name: source.name,
      enabled: source.enabled,
      terms_url: source.terms_url ?? null,
    })),
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
