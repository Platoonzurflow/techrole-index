import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { classifyDeclaredCrawler } from "@/lib/crawler-analytics";

const internalApi = process.env.INTERNAL_API_URL ?? "http://localhost:8000";
const ingestKey = process.env.ANALYTICS_INGEST_KEY ?? "";
const analyticsEnabled = process.env.ANALYTICS_ENABLED === "true";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (analyticsEnabled && ingestKey && request.method === "GET") {
    const userAgent = request.headers.get("user-agent") ?? "";
    const match = classifyDeclaredCrawler(userAgent);
    if (match) {
      event.waitUntil(fetch(`${internalApi}/api/v1/analytics/crawler`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Analytics-Ingest-Key": ingestKey,
        },
        body: JSON.stringify({ crawler_name: match.crawlerName, category: match.category, path: request.nextUrl.pathname }),
        signal: AbortSignal.timeout(2_000),
      }).catch(() => undefined));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
};
