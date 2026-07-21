import type { OfficialSalarySlice } from "@/lib/types";

export interface ResearchOpenDataItem {
  slug: string;
  name_ru: string;
  date_from: string;
  date_to: string;
  total_publications: number;
  last_ingested_at?: string;
  salary_by_seniority: OfficialSalarySlice[];
}

export function summarizeOpenData(items: ResearchOpenDataItem[]) {
  const ordered = [...items].sort((left, right) =>
    right.total_publications - left.total_publications || left.slug.localeCompare(right.slug),
  );
  const datesFrom = items.map((item) => item.date_from).filter(Boolean).sort();
  const datesTo = items.map((item) => item.date_to).filter(Boolean).sort();
  const modified = items
    .map((item) => item.last_ingested_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return {
    totalPublications: items.reduce((sum, item) => sum + item.total_publications, 0),
    representedProfessions: items.filter((item) => item.total_publications > 0).length,
    zeroResultProfessions: items.filter((item) => item.total_publications === 0).length,
    salaryReadyProfessions: items.filter((item) =>
      item.salary_by_seniority.some((slice) => slice.median != null),
    ).length,
    dateFrom: datesFrom.at(0),
    dateTo: datesTo.at(-1),
    lastModified: modified,
    top: ordered.filter((item) => item.total_publications > 0).slice(0, 15),
  };
}
