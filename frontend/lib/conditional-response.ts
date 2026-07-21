import { createHash } from "node:crypto";

function contentEtag(body: string) {
  return `"sha256-${createHash("sha256").update(body).digest("hex")}"`;
}

function weakEtag(value: string) {
  return value.trim().replace(/^W\//, "");
}

function matchesIfNoneMatch(value: string | null, etag: string) {
  if (!value) return false;
  if (value.trim() === "*") return true;
  return value.split(",").some((candidate) => weakEtag(candidate) === etag);
}

function httpDate(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(Math.floor(timestamp / 1000) * 1000).toUTCString();
}

function matchesIfModifiedSince(value: string | null, lastModified: string | null) {
  if (!value || !lastModified) return false;
  const since = Date.parse(value);
  const modified = Date.parse(lastModified);
  return Number.isFinite(since) && Number.isFinite(modified) && modified <= since;
}

function exposeValidatorHeaders(headers: Headers) {
  const values = new Set(
    (headers.get("Access-Control-Expose-Headers") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  values.add("ETag");
  values.add("Last-Modified");
  values.add("Link");
  headers.set("Access-Control-Expose-Headers", [...values].join(", "));
}

export function conditionalResponse(
  request: Request,
  body: string,
  init: ResponseInit,
  lastModifiedValue?: string | null,
) {
  const headers = new Headers(init.headers);
  const etag = contentEtag(body);
  const lastModified = httpDate(lastModifiedValue);
  headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);
  exposeValidatorHeaders(headers);

  const ifNoneMatch = request.headers.get("If-None-Match");
  const notModified = matchesIfNoneMatch(ifNoneMatch, etag)
    || (!ifNoneMatch && matchesIfModifiedSince(
      request.headers.get("If-Modified-Since"),
      lastModified,
    ));

  if (notModified) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { ...init, headers });
}
