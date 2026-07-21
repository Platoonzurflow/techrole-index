import { describe, expect, it } from "vitest";
import { citationText, citationYear, latestDataDate } from "@/lib/citation";

describe("citation metadata", () => {
  it("uses the newest available ingestion date", () => {
    expect(latestDataDate([
      { last_ingested_at: "2026-07-18T23:00:00Z" },
      {},
      { last_ingested_at: "2026-07-20T00:15:00Z" },
    ])).toBe("2026-07-20");
  });

  it("keeps the canonical open-data URL in the recommended citation", () => {
    const citation = citationText("https://techrole.example", "2026-07-20");
    expect(citation).toContain("Обновлено 2026-07-20");
    expect(citation).toContain("https://techrole.example/open-data.json");
    expect(citationYear("2026-07-20")).toBe(2026);
  });
});
