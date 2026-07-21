import { describe, expect, it } from "vitest";
import { conditionalResponse } from "@/lib/conditional-response";

const init = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60",
    "Content-Type": "application/json; charset=utf-8",
    Link: '<https://techrole.example/data.json>; rel="canonical"',
  },
};

describe("conditionalResponse", () => {
  it("adds stable content validators and exposes them to CORS clients", async () => {
    const first = conditionalResponse(
      new Request("https://techrole.example/data.json"),
      '{"ok":true}',
      init,
      "2026-07-20T22:00:00.987Z",
    );
    const second = conditionalResponse(
      new Request("https://techrole.example/data.json"),
      '{"ok":true}',
      init,
      "2026-07-20T22:00:00.987Z",
    );

    expect(first.status).toBe(200);
    expect(await first.text()).toBe('{"ok":true}');
    expect(first.headers.get("etag")).toMatch(/^"sha256-[a-f0-9]{64}"$/);
    expect(first.headers.get("etag")).toBe(second.headers.get("etag"));
    expect(first.headers.get("last-modified")).toBe("Mon, 20 Jul 2026 22:00:00 GMT");
    expect(first.headers.get("access-control-expose-headers")).toBe(
      "ETag, Last-Modified, Link",
    );
  });

  it("returns an empty 304 for matching strong, weak and wildcard validators", async () => {
    const initial = conditionalResponse(
      new Request("https://techrole.example/data.json"),
      "same body",
      init,
    );
    const etag = initial.headers.get("etag")!;

    for (const validator of [etag, `W/${etag}`, `"other", W/${etag}`, "*"]) {
      const response = conditionalResponse(
        new Request("https://techrole.example/data.json", {
          headers: { "If-None-Match": validator },
        }),
        "same body",
        init,
      );
      expect(response.status).toBe(304);
      expect(await response.text()).toBe("");
      expect(response.headers.get("etag")).toBe(etag);
      expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    }
  });

  it("honors If-Modified-Since only when If-None-Match is absent", () => {
    const lastModified = "2026-07-20T22:00:00Z";
    const byDate = conditionalResponse(
      new Request("https://techrole.example/data.json", {
        headers: { "If-Modified-Since": "Mon, 20 Jul 2026 22:00:00 GMT" },
      }),
      "body",
      init,
      lastModified,
    );
    const etagTakesPrecedence = conditionalResponse(
      new Request("https://techrole.example/data.json", {
        headers: {
          "If-None-Match": '"different"',
          "If-Modified-Since": "Tue, 21 Jul 2026 22:00:00 GMT",
        },
      }),
      "body",
      init,
      lastModified,
    );

    expect(byDate.status).toBe(304);
    expect(etagTakesPrecedence.status).toBe(200);
  });

  it("changes ETag when representation bytes change", () => {
    const first = conditionalResponse(
      new Request("https://techrole.example/data.json"),
      "first",
      init,
    );
    const second = conditionalResponse(
      new Request("https://techrole.example/data.json"),
      "second",
      init,
    );
    expect(first.headers.get("etag")).not.toBe(second.headers.get("etag"));
  });
});
