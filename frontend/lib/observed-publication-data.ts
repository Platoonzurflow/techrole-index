export interface ObservedPublicationMetric {
  metric_date: string;
  source_code: string;
  source_name: string;
  profession_slug: string;
  profession_name_ru: string;
  seniority: string;
  region_code: string;
  region_name_ru: string;
  salary_tax_status: "gross" | "net" | "unknown";
  normalized_currency: string;
  publication_count: number;
  salary_disclosed_count: number;
  salary_coverage: number;
  midpoint_sample_size: number;
  salary_median?: number | null;
  salary_average?: number | null;
  salary_p25?: number | null;
  salary_p75?: number | null;
  lower_bound_median?: number | null;
  upper_bound_median?: number | null;
  confidence_level: string;
  remote_count: number;
  remote_share: number;
  last_ingested_at: string;
  materialized_at: string;
  transform_version: string;
  current_market_claim: false;
}

export interface ObservedPublicationMetricsExport {
  salary_minimum_sample: number;
  records: ObservedPublicationMetric[];
}

export const observedPublicationFields = [
  { name: "metric_date", description: "UTC-дата публикации вакансий в срезе." },
  { name: "source_code", description: "Стабильный машинный код источника публикаций." },
  { name: "source_name", description: "Отображаемое название источника публикаций." },
  { name: "profession_slug", description: "Стабильный идентификатор профессии TechRole Index." },
  { name: "profession_name_ru", description: "Русское название профессии из таксономии TechRole Index." },
  { name: "seniority", description: "Классифицированный уровень junior, middle, senior или unknown; неизвестное не подменяется соседним уровнем." },
  { name: "region_code", description: "Стабильный код регионального среза классифицированной публикации." },
  { name: "region_name_ru", description: "Русское название регионального среза." },
  { name: "salary_tax_status", description: "Налоговый статус зарплаты gross, net или unknown; группы не смешиваются." },
  { name: "normalized_currency", description: "Валюта, в которой агрегированы зарплатные показатели среза; текущая материализация использует RUB." },
  { name: "publication_count", description: "Число публикаций по дате создания, а не одновременно активных вакансий." },
  { name: "salary_disclosed_count", description: "Число публикаций хотя бы с одной указанной границей зарплаты." },
  { name: "salary_coverage", description: "Доля publication_count с хотя бы одной указанной границей зарплаты." },
  { name: "midpoint_sample_size", description: "Число публикаций с обеими границами зарплаты, пригодных для расчёта midpoint." },
  { name: "salary_median", description: "Медиана midpoint зарплат; null, пока минимальный размер выборки не достигнут." },
  { name: "salary_average", description: "Среднее midpoint зарплат; null, пока минимальный размер выборки не достигнут." },
  { name: "salary_p25", description: "25-й процентиль midpoint зарплат; null, пока минимальный размер выборки не достигнут." },
  { name: "salary_p75", description: "75-й процентиль midpoint зарплат; null, пока минимальный размер выборки не достигнут." },
  { name: "lower_bound_median", description: "Медиана доступных нижних границ зарплаты; null, пока минимальный размер midpoint-выборки не достигнут." },
  { name: "upper_bound_median", description: "Медиана доступных верхних границ зарплаты; null, пока минимальный размер midpoint-выборки не достигнут." },
  { name: "confidence_level", description: "Уровень достаточности зарплатной выборки: insufficient, low, medium или high." },
  { name: "remote_count", description: "Число публикаций с признаком удалённой работы в срезе." },
  { name: "remote_share", description: "Доля publication_count с признаком удалённой работы." },
  { name: "last_ingested_at", description: "Максимальное время последнего наблюдения исходной публикации внутри среза." },
  { name: "materialized_at", description: "Время последнего пересчёта строки материализованного набора." },
  { name: "transform_version", description: "Версия преобразования, которым рассчитана строка." },
  { name: "current_market_claim", description: "Всегда false: набор описывает исторические публикации и не заявляет текущий размер рынка." },
] as const satisfies ReadonlyArray<{
  name: keyof ObservedPublicationMetric;
  description: string;
}>;

export interface ObservedPublicationMetricsSummary {
  dateFrom: string | null;
  dateTo: string | null;
  lastMaterializedAt: string | null;
  rowCount: number;
  publicationCount: number;
  professionCount: number;
  transformVersions: string[];
}

export function summarizeObservedPublicationMetrics(
  rows: ObservedPublicationMetric[],
): ObservedPublicationMetricsSummary {
  if (rows.length === 0) {
    return {
      dateFrom: null,
      dateTo: null,
      lastMaterializedAt: null,
      rowCount: 0,
      publicationCount: 0,
      professionCount: 0,
      transformVersions: [],
    };
  }

  let dateFrom = rows[0].metric_date;
  let dateTo = rows[0].metric_date;
  let lastMaterializedAt = rows[0].materialized_at;
  let publicationCount = 0;
  const professions = new Set<string>();
  const transformVersions = new Set<string>();

  for (const row of rows) {
    if (row.metric_date < dateFrom) dateFrom = row.metric_date;
    if (row.metric_date > dateTo) dateTo = row.metric_date;
    if (row.materialized_at > lastMaterializedAt) lastMaterializedAt = row.materialized_at;
    publicationCount += row.publication_count;
    professions.add(row.profession_slug);
    transformVersions.add(row.transform_version);
  }

  return {
    dateFrom,
    dateTo,
    lastMaterializedAt,
    rowCount: rows.length,
    publicationCount,
    professionCount: professions.size,
    transformVersions: [...transformVersions].sort(),
  };
}

export const observedPublicationCsvColumns = [
  "metric_date",
  "source_code",
  "source_name",
  "profession_slug",
  "profession_name_ru",
  "seniority",
  "region_code",
  "region_name_ru",
  "publication_count",
  "salary_disclosed_count",
  "salary_coverage",
  "complete_range_sample_size",
  "median",
  "average",
  "p25",
  "p75",
  "lower_bound_median",
  "upper_bound_median",
  "confidence_level",
  "currency",
  "salary_tax_status",
  "remote_count",
  "remote_share",
  "last_ingested_at",
  "materialized_at",
  "transform_version",
  "current_market_claim",
  "canonical_profession_url",
  "source_url",
  "methodology_url",
] as const;

function csvCell(value: string | number | boolean | null | undefined) {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildObservedPublicationCsv(rows: ObservedPublicationMetric[], siteUrl: string) {
  const values = rows.map((row) => [
    row.metric_date,
    row.source_code,
    row.source_name,
    row.profession_slug,
    row.profession_name_ru,
    row.seniority,
    row.region_code,
    row.region_name_ru,
    row.publication_count,
    row.salary_disclosed_count,
    row.salary_coverage,
    row.midpoint_sample_size,
    row.salary_median,
    row.salary_average,
    row.salary_p25,
    row.salary_p75,
    row.lower_bound_median,
    row.upper_bound_median,
    row.confidence_level,
    row.normalized_currency,
    row.salary_tax_status,
    row.remote_count,
    row.remote_share,
    row.last_ingested_at,
    row.materialized_at,
    row.transform_version,
    row.current_market_claim,
    `${siteUrl}/professions/${row.profession_slug}`,
    "https://trudvsem.ru/opendata/api",
    `${siteUrl}/methodology`,
  ]);
  return `${[observedPublicationCsvColumns, ...values].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
