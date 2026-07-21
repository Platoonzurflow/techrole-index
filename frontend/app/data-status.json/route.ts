import { safeApi } from "@/lib/api";
import type { DataProvenance } from "@/lib/types";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const provenance = await safeApi<DataProvenance | null>("/data-provenance", null);
  if (!provenance) {
    return Response.json({ detail: "Data provenance is temporarily unavailable." }, { status: 503 });
  }

  return Response.json({
    ...provenance,
    canonical_url: `${siteUrl}/data-status`,
    methodology_url: `${siteUrl}/methodology`,
    sources_url: `${siteUrl}/sources`,
    open_data_url: `${siteUrl}/open-data.json`,
    open_data_csv_url: `${siteUrl}/open-data.csv`,
    observed_publication_daily_url: `${siteUrl}/open-data-daily.json`,
    observed_publication_daily_csv_url: `${siteUrl}/open-data-daily.csv`,
    observed_publication_daily_csvw_url: `${siteUrl}/open-data-daily.csv-metadata.json`,
    observed_publication_daily_schema_url: `${siteUrl}/open-data-daily.schema.json`,
    observed_publication_daily_croissant_url: `${siteUrl}/open-data-daily.croissant.json`,
    dcat_catalog_url: `${siteUrl}/catalog.jsonld`,
    observed_publication_daily_page_url: `${siteUrl}/open-data-daily`,
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "Link": `<${siteUrl}/data-status>; rel="canonical", <${siteUrl}/methodology>; rel="describedby"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
