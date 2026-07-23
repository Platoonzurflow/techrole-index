import { describe, expect, it } from "vitest";
import { insightBibtex, insightCitationUrls, insightCsl, insightRis } from "@/lib/insight-citation";
import { insights } from "@/lib/insights";

const article = insights.find((item) => item.slug === "llm-friendly-open-text-dataset-citation")!;
const siteUrl = "https://techrole.example";

describe("article citation metadata", () => {
  it("builds a canonical CSL-JSON webpage record", () => {
    const csl = insightCsl(article, siteUrl);
    expect(csl.type).toBe("webpage");
    expect(csl.title).toBe(article.title);
    expect(csl.issued["date-parts"]).toEqual([[2026, 7, 21]]);
    expect(csl.URL).toBe(`${siteUrl}/insights/${article.slug}`);
  });

  it("exports BibTeX and RIS with the same article identity", () => {
    const bib = insightBibtex(article, siteUrl);
    const ris = insightRis(article, siteUrl);
    expect(bib).toContain("@online{techrole_index_llm_friendly_open_text_dataset_citation");
    expect(bib).toContain(`url = {${siteUrl}/insights/${article.slug}}`);
    expect(ris).toContain("TY  - ELEC");
    expect(ris).toContain(`TI  - ${article.title}`);
    expect(ris).toContain(`UR  - ${siteUrl}/insights/${article.slug}`);
  });

  it("advertises all three portable formats", () => {
    expect(insightCitationUrls(article, siteUrl)).toEqual({
      csl_json: `${siteUrl}/insight-citations/${article.slug}.csl.json`,
      bibtex: `${siteUrl}/insight-citations/${article.slug}.bib`,
      ris: `${siteUrl}/insight-citations/${article.slug}.ris`,
    });
  });
});
