const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function GET() {
  return new Response(`# TechRole Index\n\nОсновной AI-файл: ${siteUrl}/llms.txt\nПолный публичный контекст: ${siteUrl}/llms-full.txt\nОткрытые данные: ${siteUrl}/open-data.json\nCSV: ${siteUrl}/open-data.csv\nDaily dataset: ${siteUrl}/open-data-daily\nDaily CSV: ${siteUrl}/open-data-daily.csv\nCSVW metadata: ${siteUrl}/open-data-daily.csv-metadata.json\nCroissant 1.1: ${siteUrl}/open-data-daily.croissant.json\nDCAT 3: ${siteUrl}/catalog.jsonld\nСтатус данных: ${siteUrl}/data-status\nProvenance JSON: ${siteUrl}/data-status.json\nИсследование рынка: ${siteUrl}/research\nМашиночитаемый отчёт: ${siteUrl}/research.json\nМетодические разборы: ${siteUrl}/insights\nИндекс разборов: ${siteUrl}/insights.json\nКак цитировать: ${siteUrl}/citation\nCSL-JSON: ${siteUrl}/citation.json\nData Package: ${siteUrl}/datapackage.json\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
