export type CrawlerCategory = "ai_crawler" | "search_crawler";

const crawlerTokens: ReadonlyArray<readonly [string, CrawlerCategory]> = [
  ["OAI-SearchBot", "ai_crawler"],
  ["GPTBot", "ai_crawler"],
  ["ChatGPT-User", "ai_crawler"],
  ["Claude-SearchBot", "ai_crawler"],
  ["Claude-User", "ai_crawler"],
  ["ClaudeBot", "ai_crawler"],
  ["Perplexity-User", "ai_crawler"],
  ["PerplexityBot", "ai_crawler"],
  ["Googlebot", "search_crawler"],
  ["bingbot", "search_crawler"],
  ["YandexBot", "search_crawler"],
];

export function classifyDeclaredCrawler(userAgent: string) {
  const normalized = userAgent.toLowerCase();
  const match = crawlerTokens.find(([token]) => normalized.includes(token.toLowerCase()));
  return match ? { crawlerName: match[0], category: match[1] } : null;
}
