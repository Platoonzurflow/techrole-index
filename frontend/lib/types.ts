export type AccessLevel = "anonymous" | "free" | "premium";

export interface ProfessionSummary {
  id: number;
  slug: string;
  name_ru: string;
  name_en: string;
  description: string;
  category_slug: string;
  category_name: string;
  is_premium: boolean;
  teaser_only: boolean;
  score?: number;
  data_confidence?: string;
  weekly_change_percent?: number;
  weekly_direction?: "up" | "down" | "neutral" | "unknown";
}

export interface MetricPoint {
  date: string;
  seniority: "junior" | "middle" | "senior";
  vacancy_count: number;
  salary_count: number;
  salary_coverage: number;
  salary_median?: number;
  salary_average?: number;
  salary_p25?: number;
  salary_p75?: number;
  lower_bound_median?: number;
  upper_bound_median?: number;
  sample_size: number;
  confidence_level: "insufficient" | "low" | "medium" | "high";
  remote_share: number;
}

export interface Trend {
  period_days: number;
  change_percent?: number;
  direction: "up" | "down" | "neutral" | "unknown";
}

export interface OfficialSalarySlice {
  seniority: "junior" | "middle" | "senior";
  vacancy_count: number;
  salary_count: number;
  salary_coverage: number;
  sample_size: number;
  median?: number;
  average?: number;
  p25?: number;
  p75?: number;
  lower_bound_median?: number;
  upper_bound_median?: number;
  confidence_level: "insufficient" | "low" | "medium" | "high";
}

export interface OfficialOpenDataSummary {
  source_name: string;
  source_url: string;
  period_days: number;
  date_from: string;
  date_to: string;
  total_publications: number;
  salary_disclosed_count: number;
  remote_count: number;
  confidence_level: "insufficient" | "low" | "medium" | "high";
  last_ingested_at?: string;
  daily_publications: Array<{ date: string; count: number }>;
  category_total_publications: number;
  category_daily_publications: Array<{ date: string; count: number }>;
  category_salary_disclosed_count?: number;
  category_remote_count?: number;
  category_confidence_level?: "insufficient" | "low" | "medium" | "high";
  category_salary_by_seniority?: OfficialSalarySlice[];
  salary_currency: "RUB";
  salary_gross_status: "unknown";
  salary_min_sample: number;
  salary_by_seniority: OfficialSalarySlice[];
  salary_history: Array<{
    date: string;
    seniority: "junior" | "middle" | "senior";
    median?: number;
    sample_size: number;
    scope?: "profession" | "category";
  }>;
  salary_methodology_note: string;
  methodology_note: string;
}

export interface SalaryBenchmarkSource {
  id: string;
  name: string;
  url: string;
  methodology_url: string;
  period: string;
  published_at: string;
  total_sample_size?: number;
  currency: "RUB";
  tax_status: "gross" | "net" | "unknown";
  income_type: "salary" | "salary_plus_bonus";
  methodology_note: string;
}

export interface SalaryBenchmarkPoint {
  source_id: string;
  scope: "exact_role" | "related_role" | "technology" | "category" | "market_level";
  label: string;
  geography: "russia" | "moscow" | "saint_petersburg" | "regions";
  metric: "median" | "average" | "range";
  value?: number;
  lower?: number;
  upper?: number;
  p10?: number;
  p90?: number;
  seniority?: "junior" | "middle" | "senior";
  sample_size?: number;
  note?: string;
  is_fallback: boolean;
}

export interface SalaryBenchmarkSummary {
  coverage: "direct" | "related" | "category";
  points: SalaryBenchmarkPoint[];
  sources: SalaryBenchmarkSource[];
  methodology_note: string;
}

export interface SalaryBenchmarkCatalogItem {
  slug: string;
  name_ru: string;
  name_en: string;
  category_slug: string;
  benchmark: SalaryBenchmarkSummary;
}

export interface ProfessionDetail extends ProfessionSummary {
  updated_at?: string;
  scoring_version?: string;
  score_breakdown?: Record<string, number>;
  score_weights?: Record<string, number>;
  score_contributions?: Record<string, number>;
  metrics?: MetricPoint[];
  vacancy_trends?: Record<string, Trend>;
  salary_trends?: Record<string, Trend>;
  skills?: Array<{ name: string; count: number }>;
  regions?: Array<{ name: string; vacancy_count: number }>;
  tech_stack?: Array<{ title: string; items: string[] }>;
  history_days?: number;
  official_open_data?: OfficialOpenDataSummary;
  salary_benchmark?: SalaryBenchmarkSummary;
}

export interface OpenDataCatalogItem {
  slug: string;
  name_ru: string;
  category_slug: string;
  period_days: number;
  date_from: string;
  date_to: string;
  total_publications: number;
  last_ingested_at?: string;
  salary_currency: "RUB";
  salary_gross_status: "unknown";
  salary_min_sample: number;
  salary_by_seniority: OfficialSalarySlice[];
}

export interface PreparedAnalyticsLayer {
  id: "prepared_analytics";
  label: string;
  status: "prepared_baseline" | "unavailable";
  last_metric_date?: string;
  profession_count: number;
  salary_currency: "RUB";
  salary_tax_status: "gross";
  current_market_claim: false;
  interpretation: string;
}

export interface OfficialPublicationsLayer {
  id: "official_publications";
  label: string;
  status: "observed_historical" | "empty";
  source_code: string;
  source_name: string;
  source_url?: string;
  period_days: number;
  window_date_from: string;
  window_date_to: string;
  window_time_basis: "UTC_calendar_days";
  window_start_at: string;
  window_end_at_exclusive: string;
  observed_date_from?: string;
  observed_date_to?: string;
  source_records: number;
  classified_publications: number;
  salary_disclosed_records: number;
  last_ingested_at?: string;
  materialized_date_from?: string;
  materialized_date_to?: string;
  materialized_slice_count: number;
  materialized_publications: number;
  materialized_at?: string;
  materialized_transform_version?: string;
  salary_currency: "RUB";
  salary_tax_status: "unknown";
  current_market_claim: false;
  interpretation: string;
}

export interface SalaryBenchmarksLayer {
  id: "salary_benchmarks";
  label: string;
  status: "public_reference";
  profession_count: number;
  direct_professions: number;
  related_professions: number;
  category_only_professions: number;
  source_codes: string[];
  source_names: string[];
  source_urls: string[];
  latest_period: string;
  latest_published_at: string;
  latest_total_sample_size: number;
  salary_currency: "RUB";
  salary_tax_statuses: Array<"gross" | "net" | "unknown">;
  current_market_claim: false;
  interpretation: string;
}

export interface DataProvenance {
  schema_version: "1.3";
  generated_at: string;
  layers: Array<PreparedAnalyticsLayer | OfficialPublicationsLayer | SalaryBenchmarksLayer>;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: "user" | "admin";
  access_level: "free" | "premium";
  premium_expires_at?: string;
}

export interface PaymentProduct {
  code: string;
  name: string;
  description: string;
  amount: string;
  currency: "RUB";
  access_days: number;
  service_result: string;
  fulfillment_code: string;
  receipt: {
    name: string;
    payment_method: string;
    payment_object: string;
    tax: string;
  };
  refund_policy_url: string;
}

export interface PaymentCatalog {
  enabled: boolean;
  provider?: "demo" | "yookassa" | "robokassa";
  mode: "test" | "live";
  terms_version: string;
  products: PaymentProduct[];
}

export interface PaymentOrder {
  order_id: string;
  product_code: string;
  product_name: string;
  status: "creating" | "pending" | "waiting_for_capture" | "succeeded" | "canceled" | "failed" | "refunded";
  amount: string;
  currency: "RUB";
  confirmation_url?: string;
  is_test: boolean;
}

export interface PaymentRefundHistory {
  refund_id: string;
  status: string;
  amount: string;
  currency: "RUB";
  created_at: string;
  succeeded_at?: string;
}

export interface PaymentHistoryItem {
  order_id: string;
  product_code: string;
  product_name: string;
  status: string;
  amount: string;
  currency: "RUB";
  is_test: boolean;
  created_at: string;
  paid_at?: string;
  access_ends_at?: string;
  refunds: PaymentRefundHistory[];
}

export interface AnalyticsOverview {
  date_from: string;
  date_to: string;
  days: number;
  totals: {
    unique_humans: number;
    pageviews: number;
    clicks: number;
    citation_copies: number;
    ai_referrals: number;
    ai_crawler_requests: number;
    search_crawler_requests: number;
  };
  daily: Array<{
    date: string;
    unique_humans: number;
    pageviews: number;
    clicks: number;
    citation_copies: number;
    ai_crawler_requests: number;
    search_crawler_requests: number;
  }>;
  top_pages: Array<{ label: string; count: number }>;
  click_targets: Array<{ label: string; count: number }>;
  referrers: Array<{ label: string; count: number }>;
  crawlers: Array<{ label: string; count: number }>;
  measurement_notes: {
    unique_humans: string;
    citations: string;
    crawlers: string;
  };
}
