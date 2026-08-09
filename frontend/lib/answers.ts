import type { ObservedPublicationMetric } from "@/lib/observed-publication-data";
import { observedPublicationPeriod } from "@/lib/market-period";
import type { OpenDataCatalogItem } from "@/lib/types";

export type AnswerOpenDataItem = Omit<OpenDataCatalogItem, "category_slug" | "period_days"> & {
  category_slug?: string;
  period_days?: number;
};

export interface AnswerSummary {
  date_from: string | null;
  date_to: string | null;
  date_modified: string | null;
  publication_data_available: boolean;
  salary_data_available: boolean;
  top_professions: Array<{ slug: string; name: string; publications: number }>;
  salary_by_level: Array<{
    seniority: "junior" | "middle" | "senior";
    roles: Array<{ slug: string; name: string; median: number; sample_size: number }>;
  }>;
  hh_date_from: string | null;
  hh_date_to: string | null;
  hh_top_professions: Array<{ slug: string; name: string; publications: number }>;
  hh_salary_by_level: Array<{
    seniority: "junior" | "middle" | "senior";
    roles: Array<{ slug: string; name: string; median: number; sample_size: number }>;
  }>;
  hh_salary_disclosed_count: number;
  hh_salary_gross_count: number;
  hh_salary_net_count: number;
  hh_salary_tax_unknown_count: number;
  top_regions: Array<{ code: string; name: string; publications: number }>;
  publication_dynamics: {
    current_date_from: string | null;
    current_date_to: string | null;
    current_publications: number;
    previous_date_from: string | null;
    previous_date_to: string | null;
    previous_publications: number;
    change_percent: number | null;
  };
}

function isoDateOffset(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildAnswerSummary(
  items: AnswerOpenDataItem[],
  records: ObservedPublicationMetric[],
): AnswerSummary {
  const dateFrom = items.map((item) => item.date_from).filter(Boolean).sort().at(0) ?? null;
  const dateTo = items.map((item) => item.date_to).filter(Boolean).sort().at(-1) ?? null;
  const explicitDateModified = [
    ...items.map((item) => item.last_ingested_at),
    ...items.map((item) => item.hh_market_data?.last_ingested_at),
    ...records.flatMap((record) => [record.materialized_at, record.last_ingested_at]),
  ].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  // A freshly seeded publication layer may legitimately have no ingestion
  // timestamp yet. The covered period is still a stable, conservative HTTP
  // validator and avoids publishing a dynamic corpus without Last-Modified.
  const dateModified = explicitDateModified ?? (dateTo ? `${dateTo}T23:59:59Z` : null);

  const topProfessions = [...items]
    .filter((item) => item.total_publications > 0)
    .sort((left, right) => right.total_publications - left.total_publications || left.name_ru.localeCompare(right.name_ru, "ru"))
    .slice(0, 5)
    .map((item) => ({ slug: item.slug, name: item.name_ru, publications: item.total_publications }));

  const levels = (["junior", "middle", "senior"] as const).map((seniority) => ({
    seniority,
    roles: items.flatMap((item) => {
      const slice = item.salary_by_seniority.find((candidate) => candidate.seniority === seniority);
      return slice?.median == null ? [] : [{
        slug: item.slug,
        name: item.name_ru,
        median: slice.median,
        sample_size: slice.sample_size,
      }];
    }).sort((left, right) => right.sample_size - left.sample_size || left.name.localeCompare(right.name, "ru")).slice(0, 5),
  }));
  const hhItems = items.filter((item) => item.hh_market_data != null);
  const hhPeriods = hhItems.flatMap((item) => item.hh_market_data ? [observedPublicationPeriod(item.hh_market_data)] : []);
  const hhDateFrom = hhPeriods.map((item) => item.dateFrom).sort().at(0) ?? null;
  const hhDateTo = hhPeriods.map((item) => item.dateTo).sort().at(-1) ?? null;
  const hhTopProfessions = hhItems
    .filter((item) => (item.hh_market_data?.total_publications ?? 0) > 0)
    .sort((left, right) => (right.hh_market_data?.total_publications ?? 0) - (left.hh_market_data?.total_publications ?? 0) || left.name_ru.localeCompare(right.name_ru, "ru"))
    .slice(0, 5)
    .map((item) => ({ slug: item.slug, name: item.name_ru, publications: item.hh_market_data?.total_publications ?? 0 }));
  const hhLevels = (["junior", "middle", "senior"] as const).map((seniority) => ({
    seniority,
    roles: hhItems.flatMap((item) => {
      const slice = item.hh_market_data?.salary_by_seniority.find((candidate) => candidate.seniority === seniority);
      return slice?.median == null ? [] : [{
        slug: item.slug,
        name: item.name_ru,
        median: slice.median,
        sample_size: slice.sample_size,
      }];
    }).sort((left, right) => right.sample_size - left.sample_size || left.name.localeCompare(right.name, "ru")).slice(0, 5),
  }));

  const regions = new Map<string, { code: string; name: string; publications: number }>();
  for (const record of records) {
    const key = `${record.region_code}:${record.region_name_ru}`;
    const current = regions.get(key) ?? { code: record.region_code, name: record.region_name_ru, publications: 0 };
    current.publications += record.publication_count;
    regions.set(key, current);
  }
  const topRegions = [...regions.values()]
    .filter((region) => region.publications > 0)
    .sort((left, right) => right.publications - left.publications || left.name.localeCompare(right.name, "ru"))
    .slice(0, 5);

  const daily = new Map<string, number>();
  for (const record of records) {
    daily.set(record.metric_date, (daily.get(record.metric_date) ?? 0) + record.publication_count);
  }
  const latestDate = [...daily.keys()].sort().at(-1) ?? null;
  const currentFrom = latestDate ? isoDateOffset(latestDate, -6) : null;
  const previousTo = currentFrom ? isoDateOffset(currentFrom, -1) : null;
  const previousFrom = previousTo ? isoDateOffset(previousTo, -6) : null;
  const sumRange = (from: string | null, to: string | null) => {
    if (!from || !to) return 0;
    return [...daily.entries()].reduce(
      (sum, [date, count]) => sum + (date >= from && date <= to ? count : 0),
      0,
    );
  };
  const currentPublications = sumRange(currentFrom, latestDate);
  const previousPublications = sumRange(previousFrom, previousTo);
  const comparisonBase = Math.max(Math.abs(currentPublications), Math.abs(previousPublications));
  const changePercent = latestDate == null
    ? null
    : comparisonBase === 0
      ? 0
      : Math.round(Math.max(-100, Math.min(100, ((currentPublications - previousPublications) / comparisonBase) * 100)) * 10) / 10;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    date_modified: dateModified,
    publication_data_available: topProfessions.length > 0 || topRegions.length > 0,
    salary_data_available: levels.some((level) => level.roles.length > 0),
    top_professions: topProfessions,
    salary_by_level: levels,
    hh_date_from: hhDateFrom,
    hh_date_to: hhDateTo,
    hh_top_professions: hhTopProfessions,
    hh_salary_by_level: hhLevels,
    hh_salary_disclosed_count: hhItems.reduce((sum, item) => sum + (item.hh_market_data?.salary_disclosed_count ?? 0), 0),
    hh_salary_gross_count: hhItems.reduce((sum, item) => sum + (item.hh_market_data?.salary_gross_count ?? 0), 0),
    hh_salary_net_count: hhItems.reduce((sum, item) => sum + (item.hh_market_data?.salary_net_count ?? 0), 0),
    hh_salary_tax_unknown_count: hhItems.reduce((sum, item) => sum + (item.hh_market_data?.salary_tax_unknown_count ?? 0), 0),
    top_regions: topRegions,
    publication_dynamics: {
      current_date_from: currentFrom,
      current_date_to: latestDate,
      current_publications: currentPublications,
      previous_date_from: previousFrom,
      previous_date_to: previousTo,
      previous_publications: previousPublications,
      change_percent: changePercent,
    },
  };
}
