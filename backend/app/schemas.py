from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class RegisterRequest(LoginRequest):
    display_name: str = Field(min_length=2, max_length=160)


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    access_level: str


class ProfessionSummary(BaseModel):
    id: int
    slug: str
    name_ru: str
    name_en: str
    description: str
    category_slug: str
    category_name: str
    is_premium: bool
    teaser_only: bool
    score: float | None = None
    data_confidence: str | None = None
    weekly_change_percent: float | None = None
    weekly_direction: str | None = None


class MetricPoint(BaseModel):
    date: date
    seniority: str
    vacancy_count: int
    salary_count: int
    salary_coverage: float
    salary_median: float | None
    salary_average: float | None
    salary_p25: float | None
    salary_p75: float | None
    lower_bound_median: float | None
    upper_bound_median: float | None
    sample_size: int
    confidence_level: str
    remote_share: float


class TrendOut(BaseModel):
    period_days: int
    change_percent: float | None
    direction: str


class PublicationPoint(BaseModel):
    date: date
    count: int


class OfficialSalarySlice(BaseModel):
    seniority: Literal["junior", "middle", "senior"]
    vacancy_count: int
    salary_count: int
    salary_coverage: float
    sample_size: int
    median: float | None = None
    average: float | None = None
    p25: float | None = None
    p75: float | None = None
    lower_bound_median: float | None = None
    upper_bound_median: float | None = None
    confidence_level: str


class OfficialSalaryHistoryPoint(BaseModel):
    date: date
    seniority: Literal["junior", "middle", "senior"]
    median: float | None = None
    sample_size: int


class OfficialOpenDataSummary(BaseModel):
    source_name: str
    source_url: str
    period_days: int
    date_from: date
    date_to: date
    total_publications: int
    salary_disclosed_count: int
    remote_count: int
    confidence_level: str
    last_ingested_at: datetime | None = None
    daily_publications: list[PublicationPoint]
    category_total_publications: int = 0
    category_daily_publications: list[PublicationPoint] = Field(default_factory=list)
    salary_currency: str
    salary_gross_status: Literal["unknown"]
    salary_min_sample: int
    salary_by_seniority: list[OfficialSalarySlice]
    salary_history: list[OfficialSalaryHistoryPoint]
    salary_methodology_note: str
    methodology_note: str


class SalaryBenchmarkSource(BaseModel):
    id: str
    name: str
    url: str
    methodology_url: str
    period: str
    published_at: date
    total_sample_size: int | None = None
    currency: Literal["RUB"]
    tax_status: Literal["gross", "net", "unknown"]
    income_type: Literal["salary", "salary_plus_bonus"]
    methodology_note: str


class SalaryBenchmarkPoint(BaseModel):
    source_id: str
    scope: Literal[
        "exact_role",
        "related_role",
        "technology",
        "category",
        "market_level",
    ]
    label: str
    geography: Literal["russia", "moscow", "saint_petersburg", "regions"]
    metric: Literal["median", "average", "range"]
    value: float | None = None
    lower: float | None = None
    upper: float | None = None
    p10: float | None = None
    p90: float | None = None
    seniority: Literal["junior", "middle", "senior"] | None = None
    sample_size: int | None = None
    note: str | None = None
    is_fallback: bool


class SalaryBenchmarkSummary(BaseModel):
    coverage: Literal["direct", "related", "category"]
    points: list[SalaryBenchmarkPoint]
    sources: list[SalaryBenchmarkSource]
    methodology_note: str


class SalaryBenchmarkCatalogItem(BaseModel):
    slug: str
    name_ru: str
    name_en: str
    category_slug: str
    benchmark: SalaryBenchmarkSummary


class OpenDataCatalogItem(BaseModel):
    slug: str
    name_ru: str
    category_slug: str
    period_days: int
    date_from: date
    date_to: date
    total_publications: int
    last_ingested_at: datetime | None = None
    salary_currency: str
    salary_gross_status: Literal["unknown"]
    salary_min_sample: int
    salary_by_seniority: list[OfficialSalarySlice]


class ObservedPublicationMetricOut(BaseModel):
    metric_date: date
    source_code: str
    source_name: str
    profession_slug: str
    profession_name_ru: str
    seniority: str
    region_code: str
    region_name_ru: str
    salary_tax_status: Literal["gross", "net", "unknown"]
    normalized_currency: str
    publication_count: int
    salary_disclosed_count: int
    salary_coverage: float
    midpoint_sample_size: int
    salary_median: float | None = None
    salary_average: float | None = None
    salary_p25: float | None = None
    salary_p75: float | None = None
    lower_bound_median: float | None = None
    upper_bound_median: float | None = None
    confidence_level: str
    remote_count: int
    remote_share: float
    last_ingested_at: datetime
    materialized_at: datetime
    transform_version: str
    current_market_claim: Literal[False] = False


class ObservedPublicationMetricsExportOut(BaseModel):
    salary_minimum_sample: int
    records: list[ObservedPublicationMetricOut]


class ProfessionDetail(ProfessionSummary):
    updated_at: date | None = None
    scoring_version: str | None = None
    score_breakdown: dict[str, float] | None = None
    score_weights: dict[str, float] | None = None
    score_contributions: dict[str, float] | None = None
    metrics: list[MetricPoint] | None = None
    vacancy_trends: dict[str, TrendOut] | None = None
    salary_trends: dict[str, TrendOut] | None = None
    skills: list[dict[str, int | str]] | None = None
    regions: list[dict[str, int | str]] | None = None
    tech_stack: list[dict[str, str | list[str]]] | None = None
    history_days: int | None = None
    official_open_data: OfficialOpenDataSummary | None = None
    salary_benchmark: SalaryBenchmarkSummary | None = None


class ProfessionUpdate(BaseModel):
    name_ru: str | None = Field(default=None, min_length=2, max_length=180)
    name_en: str | None = Field(default=None, min_length=2, max_length=180)
    description: str | None = Field(default=None, min_length=20, max_length=3000)
    is_premium: bool | None = None
    is_active: bool | None = None


class AliasCreate(BaseModel):
    alias: str = Field(min_length=2, max_length=220)
    is_regex: bool = False
    exclude_pattern: str | None = Field(default=None, max_length=220)


class ScoreVersionCreate(BaseModel):
    version: str = Field(pattern=r"^[a-zA-Z0-9._-]{2,40}$")
    weights: dict[str, float]
    description: str = Field(min_length=20, max_length=2000)


class PaymentCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    product_code: Literal["premium_30_days"]
    accepted_terms: Literal[True]
    terms_version: str = Field(pattern=r"^[a-zA-Z0-9._-]{3,80}$")


class PaymentResponse(BaseModel):
    order_id: str
    product_code: str
    product_name: str
    status: str
    amount: Decimal
    currency: str
    confirmation_url: str | None
    is_test: bool


class DemoPaymentCompleteRequest(BaseModel):
    model_config = {"extra": "forbid"}

    outcome: Literal["succeeded", "canceled"]


class PaymentRefundRequest(BaseModel):
    model_config = {"extra": "forbid"}

    reason: str = Field(default="requested_by_customer", min_length=3, max_length=180)


class PaymentRefundResponse(BaseModel):
    refund_id: str
    order_id: str
    status: str
    amount: Decimal
    currency: str


class AlertCreate(BaseModel):
    profession_id: int = Field(gt=0)
    metric: str = Field(pattern=r"^(salary|demand)$")
    direction: str = Field(pattern=r"^(up|down)$")
    threshold_percent: float = Field(ge=3, le=100)


class SupportRequestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    topic: Literal["site", "account", "premium", "data", "other"]
    subject: str = Field(min_length=4, max_length=180)
    message: str = Field(min_length=20, max_length=5000)
    website: str = Field(default="", max_length=120)

    @field_validator("name", "subject", "message")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("name", "subject")
    @classmethod
    def reject_header_breaks(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("line breaks are not allowed")
        return value


class SupportRequestOut(BaseModel):
    reference: str
    status: str
    email_sent: bool
    message: str


class MentorshipRequestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=3, max_length=320)
    direction: Literal[
        "Не определился(ась)",
        "Frontend",
        "Backend",
        "Data / Analytics",
        "QA / Automation",
        "DevOps / Infrastructure",
        "Другое",
    ]
    level: Literal[
        "Без коммерческого опыта",
        "Стажёр / Intern",
        "Junior",
        "Middle",
        "Меняю направление",
    ]
    proposed_budget_rub: int = Field(ge=1000, le=1_000_000)
    context: str = Field(min_length=20, max_length=3000)
    website: str = Field(default="", max_length=120)

    @field_validator("name", "contact", "context")
    @classmethod
    def strip_mentorship_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("name", "contact")
    @classmethod
    def reject_mentorship_header_breaks(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("line breaks are not allowed")
        return value


class MentorshipRequestOut(BaseModel):
    reference: str
    status: str
    email_sent: bool
    message: str
