from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ProfessionCategory(Base, TimestampMixin):
    __tablename__ = "profession_categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name_ru: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")


class Profession(Base, TimestampMixin):
    __tablename__ = "professions"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name_ru: Mapped[str] = mapped_column(String(180), index=True)
    name_en: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    category_id: Mapped[int] = mapped_column(ForeignKey("profession_categories.id"), index=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProfessionAlias(Base, TimestampMixin):
    __tablename__ = "profession_aliases"
    id: Mapped[int] = mapped_column(primary_key=True)
    profession_id: Mapped[int] = mapped_column(
        ForeignKey("professions.id", ondelete="CASCADE"), index=True
    )
    alias: Mapped[str] = mapped_column(String(220), index=True)
    is_regex: Mapped[bool] = mapped_column(Boolean, default=False)
    exclude_pattern: Mapped[str | None] = mapped_column(String(220), nullable=True)
    __table_args__ = (UniqueConstraint("profession_id", "alias", name="uq_profession_alias"),)


class SeniorityLevel(Base):
    __tablename__ = "seniority_levels"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name_ru: Mapped[str] = mapped_column(String(80))
    sort_order: Mapped[int] = mapped_column(Integer)


class Region(Base):
    __tablename__ = "regions"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name_ru: Mapped[str] = mapped_column(String(160))
    timezone: Mapped[str] = mapped_column(String(60), default="Europe/Moscow")


class VacancySource(Base, TimestampMixin):
    __tablename__ = "vacancy_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    provider_type: Mapped[str] = mapped_column(String(80))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    terms_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class SourceQuery(Base, TimestampMixin):
    __tablename__ = "source_queries"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("vacancy_sources.id"), index=True)
    profession_id: Mapped[int | None] = mapped_column(ForeignKey("professions.id"), nullable=True)
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"), nullable=True)
    query_text: Mapped[str] = mapped_column(String(500))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Vacancy(Base, TimestampMixin):
    __tablename__ = "vacancies"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("vacancy_sources.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(500), index=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), index=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    salary_gross: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    salary_from: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_to: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    work_format: Mapped[str] = mapped_column(String(40), default="office")
    is_remote: Mapped[bool] = mapped_column(Boolean, default=False)
    experience_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    profession_id: Mapped[int | None] = mapped_column(
        ForeignKey("professions.id"), nullable=True, index=True
    )
    seniority_id: Mapped[int | None] = mapped_column(
        ForeignKey("seniority_levels.id"), nullable=True
    )
    classification_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    classifier_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_vacancy_source_external"),
        Index("ix_vacancy_profession_seen", "profession_id", "last_seen_at"),
    )


class VacancySkill(Base):
    __tablename__ = "vacancy_skills"
    id: Mapped[int] = mapped_column(primary_key=True)
    vacancy_id: Mapped[int] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True
    )
    skill: Mapped[str] = mapped_column(String(120), index=True)
    normalized_skill: Mapped[str] = mapped_column(String(120), index=True)
    __table_args__ = (UniqueConstraint("vacancy_id", "normalized_skill", name="uq_vacancy_skill"),)


class VacancySnapshot(Base):
    __tablename__ = "vacancy_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    vacancy_id: Mapped[int] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True
    )
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    salary_from: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_to: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    __table_args__ = (UniqueConstraint("vacancy_id", "snapshot_date", name="uq_vacancy_snapshot"),)


class SalaryObservation(Base):
    __tablename__ = "salary_observations"
    id: Mapped[int] = mapped_column(primary_key=True)
    vacancy_id: Mapped[int] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True
    )
    observed_date: Mapped[date] = mapped_column(Date, index=True)
    original_currency: Mapped[str] = mapped_column(String(3))
    normalized_currency: Mapped[str] = mapped_column(String(3), default="RUB")
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    gross: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    salary_from: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_to: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    midpoint: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    rate_provider: Mapped[str] = mapped_column(String(80))


class CurrencyRateSnapshot(Base, TimestampMixin):
    __tablename__ = "currency_rate_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(80), index=True)
    currency: Mapped[str] = mapped_column(String(3), index=True)
    requested_date: Mapped[date] = mapped_column(Date, index=True)
    effective_date: Mapped[date] = mapped_column(Date, index=True)
    rate_to_rub: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    source_url: Mapped[str] = mapped_column(String(500))
    __table_args__ = (
        UniqueConstraint(
            "provider", "currency", "requested_date", name="uq_currency_rate_snapshot"
        ),
    )


class ProfessionMetricDaily(Base):
    __tablename__ = "profession_metrics_daily"
    id: Mapped[int] = mapped_column(primary_key=True)
    metric_date: Mapped[date] = mapped_column(Date, index=True)
    profession_id: Mapped[int] = mapped_column(ForeignKey("professions.id"), index=True)
    seniority_id: Mapped[int] = mapped_column(ForeignKey("seniority_levels.id"), index=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), index=True)
    gross: Mapped[bool] = mapped_column(Boolean, default=True)
    vacancy_count: Mapped[int] = mapped_column(Integer)
    salary_count: Mapped[int] = mapped_column(Integer)
    salary_coverage: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    salary_median: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_average: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_p25: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_p75: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    lower_bound_median: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    upper_bound_median: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    sample_size: Mapped[int] = mapped_column(Integer)
    confidence_level: Mapped[str] = mapped_column(String(24))
    remote_share: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    __table_args__ = (
        UniqueConstraint(
            "metric_date",
            "profession_id",
            "seniority_id",
            "region_id",
            "gross",
            name="uq_metric_daily_slice",
        ),
        Index("ix_metric_profession_date", "profession_id", "metric_date"),
    )


class ObservedPublicationMetricDaily(Base, TimestampMixin):
    """Incremental aggregates for source publications, never active-vacancy estimates."""

    __tablename__ = "observed_publication_metrics_daily"
    id: Mapped[int] = mapped_column(primary_key=True)
    metric_date: Mapped[date] = mapped_column(Date, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("vacancy_sources.id"), index=True)
    profession_id: Mapped[int] = mapped_column(ForeignKey("professions.id"), index=True)
    seniority_code: Mapped[str] = mapped_column(String(32))
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), index=True)
    salary_tax_status: Mapped[str] = mapped_column(String(16))
    normalized_currency: Mapped[str] = mapped_column(String(3), default="RUB")
    publication_count: Mapped[int] = mapped_column(Integer)
    salary_disclosed_count: Mapped[int] = mapped_column(Integer)
    salary_coverage: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    midpoint_sample_size: Mapped[int] = mapped_column(Integer)
    salary_median: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_average: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_p25: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_p75: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    lower_bound_median: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    upper_bound_median: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    confidence_level: Mapped[str] = mapped_column(String(24))
    remote_count: Mapped[int] = mapped_column(Integer)
    remote_share: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    last_ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    transform_version: Mapped[str] = mapped_column(String(40))
    transform_run_id: Mapped[str] = mapped_column(String(36), index=True)
    __table_args__ = (
        UniqueConstraint(
            "metric_date",
            "source_id",
            "profession_id",
            "seniority_code",
            "region_id",
            "salary_tax_status",
            "normalized_currency",
            name="uq_observed_publication_metric_slice",
        ),
        Index(
            "ix_observed_publication_source_date",
            "source_id",
            "metric_date",
        ),
        Index(
            "ix_observed_publication_profession_date",
            "profession_id",
            "metric_date",
        ),
    )


class ScoringVersion(Base, TimestampMixin):
    __tablename__ = "scoring_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(40), unique=True)
    weights: Mapped[dict[str, Any]] = mapped_column(JSON)
    description: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class ProfessionScoreDaily(Base):
    __tablename__ = "profession_scores_daily"
    id: Mapped[int] = mapped_column(primary_key=True)
    score_date: Mapped[date] = mapped_column(Date, index=True)
    profession_id: Mapped[int] = mapped_column(ForeignKey("professions.id"), index=True)
    scoring_version_id: Mapped[int] = mapped_column(ForeignKey("scoring_versions.id"))
    score: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    breakdown: Mapped[dict[str, Any]] = mapped_column(JSON)
    data_confidence: Mapped[str] = mapped_column(String(24))
    __table_args__ = (
        UniqueConstraint(
            "score_date", "profession_id", "scoring_version_id", name="uq_score_daily"
        ),
    )


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("vacancy_sources.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    records_seen: Mapped[int] = mapped_column(Integer, default=0)
    records_changed: Mapped[int] = mapped_column(Integer, default=0)
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(500))
    display_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(20), default="user", index=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(60))
    external_id: Mapped[str] = mapped_column(String(160), unique=True)
    status: Mapped[str] = mapped_column(String(24), index=True)
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PaymentOrder(Base, TimestampMixin):
    __tablename__ = "payment_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_code: Mapped[str] = mapped_column(String(80), index=True)
    provider: Mapped[str] = mapped_column(String(60), index=True)
    external_payment_id: Mapped[str | None] = mapped_column(
        String(160), nullable=True, unique=True
    )
    client_idempotency_key: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    description: Mapped[str] = mapped_column(String(180))
    product_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    terms_version: Mapped[str] = mapped_column(String(80))
    terms_accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmation_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_test: Mapped[bool] = mapped_column(Boolean, default=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    canceled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    __table_args__ = (
        UniqueConstraint(
            "user_id", "client_idempotency_key", name="uq_payment_order_user_idempotency"
        ),
    )


class PaymentRefund(Base, TimestampMixin):
    __tablename__ = "payment_refunds"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    payment_order_id: Mapped[int] = mapped_column(
        ForeignKey("payment_orders.id"), index=True
    )
    provider: Mapped[str] = mapped_column(String(60), index=True)
    external_refund_id: Mapped[str | None] = mapped_column(
        String(160), nullable=True, unique=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    reason: Mapped[str] = mapped_column(String(180))
    succeeded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Entitlement(Base, TimestampMixin):
    __tablename__ = "entitlements"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    code: Mapped[str] = mapped_column(String(80), index=True)
    source: Mapped[str] = mapped_column(String(80))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (Index("ix_entitlement_user_code", "user_id", "code"),)


class PaymentEvent(Base, TimestampMixin):
    __tablename__ = "payment_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(60), index=True)
    external_event_id: Mapped[str] = mapped_column(String(180))
    event_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        UniqueConstraint(
            "provider", "external_event_id", name="uq_payment_event_provider_external"
        ),
    )


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_date: Mapped[date] = mapped_column(Date, index=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    visitor_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(24), index=True)
    event_type: Mapped[str] = mapped_column(String(32), index=True)
    path: Mapped[str] = mapped_column(String(512), index=True)
    target_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    referrer_host: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    crawler_name: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    __table_args__ = (
        Index("ix_analytics_event_date_category", "event_date", "category"),
        Index("ix_analytics_event_date_type", "event_date", "event_type"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class SupportRequest(Base, TimestampMixin):
    __tablename__ = "support_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(36), unique=True, index=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320), index=True)
    topic: Mapped[str] = mapped_column(String(40), index=True)
    subject: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="received", index=True)
    delivery_attempts: Mapped[int] = mapped_column(Integer, default=0)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(160), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)


class MentorshipRequest(Base, TimestampMixin):
    __tablename__ = "mentorship_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(36), unique=True, index=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    contact: Mapped[str] = mapped_column(String(320), index=True)
    direction: Mapped[str] = mapped_column(String(80), index=True)
    level: Mapped[str] = mapped_column(String(80), index=True)
    proposed_budget_rub: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="received", index=True)
    delivery_attempts: Mapped[int] = mapped_column(Integer, default=0)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(160), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)


class NotificationRule(Base, TimestampMixin):
    __tablename__ = "notification_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    profession_id: Mapped[int] = mapped_column(
        ForeignKey("professions.id", ondelete="CASCADE"), index=True
    )
    metric: Mapped[str] = mapped_column(String(40))
    direction: Mapped[str] = mapped_column(String(16))
    threshold_percent: Mapped[Decimal] = mapped_column(Numeric(7, 3))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
