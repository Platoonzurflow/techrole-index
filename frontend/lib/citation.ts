export interface CitableOpenDataItem {
  last_ingested_at?: string;
}

export function latestDataDate(items: CitableOpenDataItem[]): string | undefined {
  return items
    .map((item) => item.last_ingested_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
    ?.slice(0, 10);
}

export function citationText(siteUrl: string, date?: string): string {
  const update = date ? ` Обновлено ${date}.` : "";
  return `TechRole Index. Аналитика IT-профессий и открытые данные о публикациях вакансий.${update} ${siteUrl}/open-data.json`;
}

export function citationYear(date?: string): number {
  const year = date ? Number(date.slice(0, 4)) : new Date().getUTCFullYear();
  return Number.isInteger(year) ? year : new Date().getUTCFullYear();
}
