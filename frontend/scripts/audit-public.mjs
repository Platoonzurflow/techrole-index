const fetchBase = new URL(process.env.PUBLIC_AUDIT_FETCH_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:3000");
const concurrency = Math.max(1, Math.min(12, Number(process.env.PUBLIC_AUDIT_CONCURRENCY ?? 6)));
const fetchAttempts = Math.max(1, Math.min(5, Number(process.env.PUBLIC_AUDIT_FETCH_ATTEMPTS ?? 3)));
const minimumUrls = Math.max(1, Number(process.env.PUBLIC_AUDIT_MIN_URLS ?? 60));

const decodeEntities = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => [match[1].toLowerCase(), decodeEntities(match[2] ?? match[3] ?? "")]),
);

const textContent = (value) => decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const normalizeUrl = (value) => {
  const url = new URL(value);
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  url.hash = "";
  return url.toString();
};

async function getText(url) {
  let lastError;
  for (let attempt = 1; attempt <= fetchAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      const body = await response.text();
      const transientStatus = response.status === 429 || response.status >= 500;
      if (!transientStatus || attempt === fetchAttempts) return { body, response };
      lastError = new Error(`transient HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  throw lastError;
}

const sitemapResponse = await getText(new URL("/sitemap.xml", fetchBase));
if (!sitemapResponse.response.ok) {
  throw new Error(`sitemap returned ${sitemapResponse.response.status}`);
}

const sitemapUrls = [...new Set(
  [...sitemapResponse.body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeEntities(match[1].trim())),
)];
if (sitemapUrls.length < minimumUrls) {
  throw new Error(`sitemap has ${sitemapUrls.length} URLs; expected at least ${minimumUrls}`);
}

const results = new Array(sitemapUrls.length);
let nextIndex = 0;

async function worker() {
  while (nextIndex < sitemapUrls.length) {
    const index = nextIndex++;
    const canonicalUrl = sitemapUrls[index];
    const sourceUrl = new URL(canonicalUrl);
    const target = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, fetchBase);
    const errors = [];
    try {
      let { body, response } = await getText(target);
      const hasNoindex = [...body.matchAll(/<meta\b[^>]*>/gi)]
        .map((match) => attributes(match[0]))
        .some((tag) => tag.name?.toLowerCase() === "robots" && tag.content?.toLowerCase().includes("noindex"));
      if (response.ok && hasNoindex) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        ({ body, response } = await getText(target));
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) errors.push(`HTTP ${response.status}`);
      if (!contentType.toLowerCase().includes("text/html")) errors.push(`content-type ${contentType || "missing"}`);

      const titles = [...body.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((match) => textContent(match[1]));
      if (titles.length !== 1 || !titles[0]) errors.push(`expected one non-empty title, found ${titles.length}`);

      const metaTags = [...body.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]));
      const descriptions = metaTags.filter((tag) => tag.name?.toLowerCase() === "description").map((tag) => tag.content?.trim());
      if (descriptions.length !== 1 || !descriptions[0]) errors.push(`expected one non-empty description, found ${descriptions.length}`);
      const robots = metaTags.filter((tag) => tag.name?.toLowerCase() === "robots").map((tag) => tag.content?.toLowerCase() ?? "");
      if (robots.some((value) => value.includes("noindex"))) errors.push("page is marked noindex");

      const canonicalTags = [...body.matchAll(/<link\b[^>]*>/gi)]
        .map((match) => attributes(match[0]))
        .filter((tag) => tag.rel?.toLowerCase().split(/\s+/).includes("canonical"));
      if (canonicalTags.length !== 1 || !canonicalTags[0]?.href) {
        errors.push(`expected one canonical, found ${canonicalTags.length}`);
      } else if (normalizeUrl(canonicalTags[0].href) !== normalizeUrl(canonicalUrl)) {
        errors.push(`canonical ${canonicalTags[0].href} does not match sitemap URL`);
      }

      const h1Count = [...body.matchAll(/<h1\b/gi)].length;
      if (h1Count !== 1) errors.push(`expected one h1, found ${h1Count}`);
      const htmlTag = body.match(/<html\b[^>]*>/i)?.[0];
      if (!htmlTag || attributes(htmlTag).lang?.toLowerCase() !== "ru") errors.push("html lang is not ru");

      const jsonLdScripts = [...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter((match) => attributes(match[1]).type?.toLowerCase() === "application/ld+json");
      if (!jsonLdScripts.length) errors.push("JSON-LD is missing");
      for (const script of jsonLdScripts) {
        try {
          JSON.parse(script[2]);
        } catch (error) {
          errors.push(`invalid JSON-LD: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      results[index] = { canonicalUrl, description: descriptions[0] ?? "", errors, title: titles[0] ?? "" };
    } catch (error) {
      results[index] = { canonicalUrl, description: "", errors: [error instanceof Error ? error.message : String(error)], title: "" };
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, sitemapUrls.length) }, () => worker()));

for (const field of ["title", "description"]) {
  const byValue = new Map();
  for (const result of results) {
    if (!result[field]) continue;
    const urls = byValue.get(result[field]) ?? [];
    urls.push(result.canonicalUrl);
    byValue.set(result[field], urls);
  }
  for (const [value, urls] of byValue) {
    if (urls.length < 2) continue;
    for (const url of urls) {
      results.find((result) => result.canonicalUrl === url).errors.push(`duplicate ${field} shared by ${urls.length} URLs: ${value.slice(0, 100)}`);
    }
  }
}

const failed = results.filter((result) => result.errors.length);
console.log(JSON.stringify({ checked: results.length, failed: failed.length, fetch_base: fetchBase.toString(), sitemap: sitemapUrls[0] }, null, 2));
for (const result of failed) console.error(`${result.canonicalUrl}\n  - ${result.errors.join("\n  - ")}`);
if (failed.length) process.exitCode = 1;
