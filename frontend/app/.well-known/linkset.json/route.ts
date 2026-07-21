import { conditionalResponse } from "@/lib/conditional-response";
import { buildDatasetLinkset } from "@/lib/dataset-linkset";

export function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const base = siteUrl.replace(/\/$/, "");
  const body = JSON.stringify(buildDatasetLinkset(base));

  return conditionalResponse(request, body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Language": "en",
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Link": `<${base}/.well-known/linkset.json>; rel="self"; type="application/linkset+json", <${base}/open-data-daily>; rel="collection"; type="text/html"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
