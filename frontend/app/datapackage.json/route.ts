import { safeApi } from "@/lib/api";
import { latestDataDate, type CitableOpenDataItem } from "@/lib/citation";
import { russianFederalOpenDataTermsUrl } from "@/lib/data-licensing";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = await safeApi<CitableOpenDataItem[]>("/open-data/publications", []);
  return Response.json({
    profile: "data-package",
    name: "techrole-index-open-data",
    title: "TechRole Index: открытые данные об IT-профессиях",
    description: "Машиночитаемый каталог сущностей, публикаций и доступных зарплатных срезов с provenance и правилами интерпретации.",
    homepage: `${siteUrl}/citation`,
    created: latestDataDate(items),
    licenses: [
      {
        name: "Russian-Federal-Open-Data-Terms",
        path: russianFederalOpenDataTermsUrl,
        title: "Типовые условия использования открытых данных Российской Федерации",
      },
    ],
    sources: [
      { title: "Работа России: открытые данные", path: "https://trudvsem.ru/opendata" },
      { title: "Методология TechRole Index", path: `${siteUrl}/methodology` },
    ],
    resources: [
      { name: "official-open-data", path: `${siteUrl}/open-data.json`, format: "json", mediatype: "application/ld+json", description: "Schema.org DataCatalog и 50 Dataset." },
      { name: "official-open-data-csv", path: `${siteUrl}/open-data.csv`, format: "csv", mediatype: "text/csv", description: "Профессии и seniority-срезы с периодом, n, confidence, tax status и provenance." },
      { name: "observed-publications-daily", path: `${siteUrl}/open-data-daily.json`, format: "json", mediatype: "application/json", description: "Daily creation-date slices из isolated observed layer с transform version и quality-gated зарплатами." },
      { name: "observed-publications-daily-csv", path: `${siteUrl}/open-data-daily.csv`, format: "csv", mediatype: "text/csv", description: "Плоский переносимый вариант daily slices с source, region, seniority, tax status и provenance." },
      { name: "observed-publications-daily-csvw", path: `${siteUrl}/open-data-daily.csv-metadata.json`, format: "json", mediatype: "application/csvm+json", description: "W3C CSV on the Web metadata: 30 фактических колонок, datatypes, nullable cells, составной primary key и provenance." },
      { name: "observed-publications-daily-schema", path: `${siteUrl}/open-data-daily.schema.json`, format: "json", mediatype: "application/schema+json", description: "Строгий JSON Schema Draft 2020-12 для метаданных и каждой строки daily dataset." },
      { name: "observed-publications-daily-croissant", path: `${siteUrl}/open-data-daily.croissant.json`, format: "json", mediatype: "application/ld+json", description: "Croissant 1.1 metadata: фактические CSV-колонки, типы, составной ключ, provenance и условия использования." },
      { name: "dcat-catalog", path: `${siteUrl}/catalog.jsonld`, format: "jsonld", mediatype: "application/ld+json", description: "W3C DCAT 3 каталог: Dataset, прямые distributions, DataService, provenance и условия использования." },
      { name: "ai-entity-index", path: `${siteUrl}/ai-index.json`, format: "json", mediatype: "application/json", description: "Канонические сущности и правила интерпретации." },
      { name: "llm-public-context", path: `${siteUrl}/llms-full.txt`, format: "txt", mediatype: "text/plain", description: "Полный открытый текстовый контекст без Premium-полей." },
      { name: "research-report", path: `${siteUrl}/research.json`, format: "json", mediatype: "application/json", description: "Агрегаты 180-дневного слоя и топ профессий." },
      { name: "editorial-insights", path: `${siteUrl}/insights.json`, format: "json", mediatype: "application/json", description: "Двенадцать методических разборов с каноническими URL, ссылками на основания и per-article CSL-JSON/BibTeX/RIS." },
    ],
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      "Content-Language": "ru-RU",
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  });
}
