import { buildObservedPublicationDatasetSchema } from "@/lib/observed-publication-schema";
import { conditionalResponse } from "@/lib/conditional-response";

export async function GET(request: Request) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const body = JSON.stringify(buildObservedPublicationDatasetSchema(siteUrl));
  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Language": "en",
      "Content-Type": "application/schema+json; charset=utf-8",
      "Link": `<${siteUrl}/open-data-daily.schema.json>; rel="canonical", <${siteUrl}/open-data-daily>; rel="describedby", <${siteUrl}/open-data-daily.croissant.json>; rel="describedby"; type="application/ld+json"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
