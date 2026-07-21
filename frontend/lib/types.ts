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
  salary_currency: "RUB";
  salary_gross_status: "unknown";
  salary_min_sample: number;
  salary_by_seniority: OfficialSalarySlice[];
  salary_history: Array<{
    date: string;
    seniority: "junior" | "middle" | "senior";
    median?: number;
    sample_size: number;
  }>;
  salary_methodology_note: string;
  methodology_note: string;
}

export interface ProfessionDetail extends ProfessionSummary {
  updated_at?: string;
  scoring_version?: string;
  score_breakdown?: Record<string, number>;
  metrics?: MetricPoint[];
  vacancy_trends?: Record<string, Trend>;
  salary_trends?: Record<string, Trend>;
  skills?: Array<{ name: string; count: number }>;
  regions?: Array<{ name: string; vacancy_count: number }>;
  tech_stack?: Array<{ title: string; items: string[] }>;
  history_days?: number;
  official_open_data?: OfficialOpenDataSummary;
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

export interface DataProvenance {
  schema_version: "1.2";
  generated_at: string;
  layers: Array<PreparedAnalyticsLayer | OfficialPublicationsLayer>;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: "user" | "admin";
  access_level: "free" | "premium";
}

export interface PaymentProduct {
  code: "premium_30_days";
  name: string;
  description: string;
  amount: string;
  currency: "RUB";
  access_days: number;
}

export interface PaymentCatalog {
  enabled: boolean;
  provider?: "demo" | "yookassa";
  mode: "test" | "live";
  terms_version: string;
  products: PaymentProduct[];
}

export interface PaymentOrder {
  order_id: string;
  product_code: "premium_30_days";
  product_name: string;
  status: "creating" | "pending" | "waiting_for_capture" | "succeeded" | "canceled" | "failed" | "refunded";
  amount: string;
  currency: "RUB";
  confirmation_url?: string;
  is_test: boolean;
}
