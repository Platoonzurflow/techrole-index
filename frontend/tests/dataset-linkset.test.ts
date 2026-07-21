import { describe, expect, it } from "vitest";
import { buildDatasetLinkset } from "@/lib/dataset-linkset";

describe("RFC 9264 dataset linkset", () => {
  it("connects the canonical landing page, content resources, and metadata", () => {
    const siteUrl = "https://techrole.example";
    const payload = buildDatasetLinkset(`${siteUrl}/`);
    const landing = payload.linkset[0];

    expect(payload.linkset).toHaveLength(4);
    expect(landing.anchor).toBe(`${siteUrl}/open-data-daily`);
    expect(landing["cite-as"]).toEqual([{ href: landing.anchor, type: "text/html" }]);
    expect(landing.item).toEqual([
      { href: `${siteUrl}/open-data-daily.json`, type: "application/json" },
      { href: `${siteUrl}/open-data-daily.csv`, type: "text/csv" },
    ]);
    expect(landing.describedby?.map((item) => item.href)).toEqual(expect.arrayContaining([
      `${siteUrl}/open-data-daily.schema.json`,
      `${siteUrl}/open-data-daily.croissant.json`,
      `${siteUrl}/open-data-daily.csv-metadata.json`,
      `${siteUrl}/catalog.jsonld`,
      `${siteUrl}/citation.json`,
    ]));
    expect(payload.linkset.slice(1).every((context) =>
      context.collection?.[0].href === landing.anchor)).toBe(true);
  });
});
