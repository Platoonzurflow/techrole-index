import { conditionalResponse } from "@/lib/conditional-response";
import { insights } from "@/lib/insights";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function GET(request: Request) {
  const content = `# TechRole Index

Основной AI-файл: ${siteUrl}/llms.txt
Полный публичный контекст: ${siteUrl}/llms-full.txt
Короткие проверяемые ответы: ${siteUrl}/answers
JSON коротких ответов: ${siteUrl}/answers.json
Открытые данные: ${siteUrl}/open-data.json
CSV: ${siteUrl}/open-data.csv
Daily dataset: ${siteUrl}/open-data-daily
Daily CSV: ${siteUrl}/open-data-daily.csv
CSVW metadata: ${siteUrl}/open-data-daily.csv-metadata.json
Croissant 1.1: ${siteUrl}/open-data-daily.croissant.json
DCAT 3: ${siteUrl}/catalog.jsonld
Статус данных: ${siteUrl}/data-status
Provenance JSON: ${siteUrl}/data-status.json
Исследование рынка: ${siteUrl}/research
Машиночитаемый отчёт: ${siteUrl}/research.json
Методические разборы: ${siteUrl}/insights
Индекс разборов: ${siteUrl}/insights.json
Как цитировать: ${siteUrl}/citation
CSL-JSON: ${siteUrl}/citation.json
BibTeX: ${siteUrl}/citation.bib
RIS: ${siteUrl}/citation.ris
Data Package: ${siteUrl}/datapackage.json
`;
  return conditionalResponse(request, content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": "ru-RU",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Link": `<${siteUrl}/>; rel="canonical", <${siteUrl}/citation>; rel="cite-as"`,
      "X-Robots-Tag": "index, follow, max-snippet:-1",
    },
  }, insights.map((item) => item.updatedAt).sort().at(-1));
}
