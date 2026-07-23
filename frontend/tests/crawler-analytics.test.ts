import { describe, expect, it } from "vitest";
import { classifyDeclaredCrawler } from "@/lib/crawler-analytics";

describe("declared crawler classification", () => {
  it("recognizes documented AI and search crawler tokens case-insensitively", () => {
    expect(classifyDeclaredCrawler("Mozilla/5.0 compatible; OAI-SearchBot/1.0")).toEqual({
      crawlerName: "OAI-SearchBot",
      category: "ai_crawler",
    });
    expect(classifyDeclaredCrawler("bingbot/2.0")).toEqual({
      crawlerName: "bingbot",
      category: "search_crawler",
    });
    expect(classifyDeclaredCrawler("Mozilla/5.0 YANDEXBOT/3.0")).toEqual({
      crawlerName: "YandexBot",
      category: "search_crawler",
    });
  });

  it("does not classify ordinary browsers or near-match names", () => {
    expect(classifyDeclaredCrawler("Mozilla/5.0 Chrome/140 Safari/537.36")).toBeNull();
    expect(classifyDeclaredCrawler("MyPerplexityViewer/1.0")).toBeNull();
  });
});
