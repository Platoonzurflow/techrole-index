from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from importlib.resources import files
from typing import Any
from uuid import uuid4

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.domain.salary import SalaryInput, calculate_salary_statistics
from app.models import (
    ObservedPublicationMetricDaily,
    SalaryObservation,
    SeniorityLevel,
    Vacancy,
    VacancySource,
    utcnow,
)

TRANSFORM_VERSION = "observed-publications-v1"
_POSTGRES_SQL = files("app.sql").joinpath("observed_publication_metrics_daily.sql").read_text(
    encoding="utf-8"
)


@dataclass(frozen=True)
class PublicationMetricTransformSummary:
    status: str
    source: str
    date_from: date | None
    date_to: date | None
    slice_count: int
    publication_count: int
    salary_disclosed_count: int
    midpoint_sample_size: int
    deleted_stale_slices: int
    transform_version: str = TRANSFORM_VERSION
    reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _decimal(value: float | None) -> Decimal | None:
    return Decimal(str(value)) if value is not None else None


def _tax_status(value: bool | None) -> str:
    if value is True:
        return "gross"
    if value is False:
        return "net"
    return "unknown"


def _skipped(
    source: str,
    *,
    reason: str,
    date_from: date | None = None,
    date_to: date | None = None,
) -> PublicationMetricTransformSummary:
    return PublicationMetricTransformSummary(
        status="skipped",
        source=source,
        date_from=date_from,
        date_to=date_to,
        slice_count=0,
        publication_count=0,
        salary_disclosed_count=0,
        midpoint_sample_size=0,
        deleted_stale_slices=0,
        reason=reason,
    )


def _validate_rows(
    rows: Sequence[ObservedPublicationMetricDaily],
    *,
    expected_publications: int,
    min_salary_sample: int,
) -> None:
    if not rows:
        raise RuntimeError("Publication transform produced no slices")
    if sum(row.publication_count for row in rows) != expected_publications:
        raise RuntimeError("Publication transform row count does not match classified input")
    for row in rows:
        if not (
            0 <= row.midpoint_sample_size <= row.salary_disclosed_count <= row.publication_count
        ):
            raise RuntimeError("Publication transform salary counts violate quality gates")
        if not (0 <= row.remote_count <= row.publication_count):
            raise RuntimeError("Publication transform remote counts violate quality gates")
        if not (Decimal("0") <= row.salary_coverage <= Decimal("1")):
            raise RuntimeError("Publication transform salary coverage is outside 0..1")
        if not (Decimal("0") <= row.remote_share <= Decimal("1")):
            raise RuntimeError("Publication transform remote share is outside 0..1")
        if row.midpoint_sample_size < min_salary_sample and any(
            value is not None
            for value in (
                row.salary_median,
                row.salary_average,
                row.salary_p25,
                row.salary_p75,
                row.lower_bound_median,
                row.upper_bound_median,
            )
        ):
            raise RuntimeError("Publication transform exposed salary values below sample gate")


def _portable_refresh(
    db: Session,
    *,
    source: VacancySource,
    date_from: date,
    date_to: date,
    run_id: str,
    expected_publications: int,
    min_salary_sample: int,
) -> PublicationMetricTransformSummary:
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
    vacancy_rows = db.execute(
        select(Vacancy, SeniorityLevel.code)
        .outerjoin(SeniorityLevel, SeniorityLevel.id == Vacancy.seniority_id)
        .where(
            Vacancy.source_id == source.id,
            Vacancy.profession_id.is_not(None),
            Vacancy.published_at >= start,
            Vacancy.published_at < end,
        )
    ).all()
    vacancy_ids = [vacancy.id for vacancy, _ in vacancy_rows]
    latest_salary: dict[int, SalaryObservation] = {}
    if vacancy_ids:
        observations = db.scalars(
            select(SalaryObservation)
            .where(
                SalaryObservation.vacancy_id.in_(vacancy_ids),
                SalaryObservation.normalized_currency == "RUB",
            )
            .order_by(
                SalaryObservation.vacancy_id,
                SalaryObservation.observed_date,
                SalaryObservation.id,
            )
        ).all()
        for stored_observation in observations:
            latest_salary[stored_observation.vacancy_id] = stored_observation

    grouped: dict[tuple[Any, ...], list[tuple[Vacancy, SalaryInput]]] = defaultdict(list)
    for vacancy, seniority_code in vacancy_rows:
        observation = latest_salary.get(vacancy.id)
        gross = (
            observation.gross
            if observation is not None and observation.gross is not None
            else vacancy.salary_gross
        )
        lower = observation.salary_from if observation is not None else None
        upper = observation.salary_to if observation is not None else None
        if lower is None and vacancy.currency == "RUB":
            lower = vacancy.salary_from
        if upper is None and vacancy.currency == "RUB":
            upper = vacancy.salary_to
        key = (
            vacancy.published_at.date(),
            source.id,
            vacancy.profession_id,
            seniority_code or "unknown",
            vacancy.region_id,
            _tax_status(gross),
            "RUB",
        )
        grouped[key].append((vacancy, SalaryInput(lower=lower, upper=upper, gross=gross)))

    existing_rows = db.scalars(
        select(ObservedPublicationMetricDaily).where(
            ObservedPublicationMetricDaily.source_id == source.id,
            ObservedPublicationMetricDaily.metric_date >= date_from,
            ObservedPublicationMetricDaily.metric_date <= date_to,
        )
    ).all()
    existing = {
        (
            row.metric_date,
            row.source_id,
            row.profession_id,
            row.seniority_code,
            row.region_id,
            row.salary_tax_status,
            row.normalized_currency,
        ): row
        for row in existing_rows
    }
    now = utcnow()
    for key, group in grouped.items():
        gross = {"gross": True, "net": False, "unknown": None}[key[5]]
        stats = calculate_salary_statistics(
            [salary for _, salary in group],
            total_vacancies=len(group),
            min_sample=min_salary_sample,
            gross=gross,
        )
        remote_count = sum(int(vacancy.is_remote) for vacancy, _ in group)
        publish_bounds = stats.midpoint_sample_size >= min_salary_sample
        row = existing.get(key)
        if row is None:
            row = ObservedPublicationMetricDaily(
                metric_date=key[0],
                source_id=key[1],
                profession_id=key[2],
                seniority_code=key[3],
                region_id=key[4],
                salary_tax_status=key[5],
                normalized_currency=key[6],
                publication_count=len(group),
                salary_disclosed_count=stats.salary_count,
                salary_coverage=Decimal(str(stats.salary_coverage)),
                midpoint_sample_size=stats.midpoint_sample_size,
                confidence_level=stats.confidence_level,
                remote_count=remote_count,
                remote_share=Decimal(str(round(remote_count / len(group), 5))),
                last_ingested_at=max(vacancy.last_seen_at for vacancy, _ in group),
                transform_version=TRANSFORM_VERSION,
                transform_run_id=run_id,
            )
            db.add(row)
        row.publication_count = len(group)
        row.salary_disclosed_count = stats.salary_count
        row.salary_coverage = Decimal(str(stats.salary_coverage))
        row.midpoint_sample_size = stats.midpoint_sample_size
        row.salary_median = _decimal(stats.median)
        row.salary_average = _decimal(stats.average)
        row.salary_p25 = _decimal(stats.p25)
        row.salary_p75 = _decimal(stats.p75)
        row.lower_bound_median = _decimal(stats.lower_bound_median) if publish_bounds else None
        row.upper_bound_median = _decimal(stats.upper_bound_median) if publish_bounds else None
        row.confidence_level = stats.confidence_level
        row.remote_count = remote_count
        row.remote_share = Decimal(str(round(remote_count / len(group), 5)))
        row.last_ingested_at = max(vacancy.last_seen_at for vacancy, _ in group)
        row.transform_version = TRANSFORM_VERSION
        row.transform_run_id = run_id
        row.updated_at = now

    stale = [row for key, row in existing.items() if key not in grouped]
    for row in stale:
        db.delete(row)
    db.flush()
    transformed = db.scalars(
        select(ObservedPublicationMetricDaily).where(
            ObservedPublicationMetricDaily.source_id == source.id,
            ObservedPublicationMetricDaily.metric_date >= date_from,
            ObservedPublicationMetricDaily.metric_date <= date_to,
            ObservedPublicationMetricDaily.transform_run_id == run_id,
        )
    ).all()
    _validate_rows(
        transformed,
        expected_publications=expected_publications,
        min_salary_sample=min_salary_sample,
    )
    db.commit()
    return PublicationMetricTransformSummary(
        status="success",
        source=source.code,
        date_from=date_from,
        date_to=date_to,
        slice_count=len(transformed),
        publication_count=sum(row.publication_count for row in transformed),
        salary_disclosed_count=sum(row.salary_disclosed_count for row in transformed),
        midpoint_sample_size=sum(row.midpoint_sample_size for row in transformed),
        deleted_stale_slices=len(stale),
    )


def _postgres_refresh(
    db: Session,
    *,
    source: VacancySource,
    date_from: date,
    date_to: date,
    run_id: str,
    expected_publications: int,
    min_salary_sample: int,
) -> PublicationMetricTransformSummary:
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_name))"),
        {"lock_name": f"observed-publication-metrics:{source.id}"},
    )
    db.execute(
        text(_POSTGRES_SQL),
        {
            "source_id": source.id,
            "date_from": date_from,
            "date_to": date_to,
            "min_salary_sample": min_salary_sample,
            "transform_version": TRANSFORM_VERSION,
            "transform_run_id": run_id,
        },
    ).mappings().one()
    deleted = db.execute(
        delete(ObservedPublicationMetricDaily).where(
            ObservedPublicationMetricDaily.source_id == source.id,
            ObservedPublicationMetricDaily.metric_date >= date_from,
            ObservedPublicationMetricDaily.metric_date <= date_to,
            ObservedPublicationMetricDaily.transform_run_id != run_id,
        )
    )
    transformed = db.scalars(
        select(ObservedPublicationMetricDaily).where(
            ObservedPublicationMetricDaily.source_id == source.id,
            ObservedPublicationMetricDaily.metric_date >= date_from,
            ObservedPublicationMetricDaily.metric_date <= date_to,
            ObservedPublicationMetricDaily.transform_run_id == run_id,
        )
    ).all()
    _validate_rows(
        transformed,
        expected_publications=expected_publications,
        min_salary_sample=min_salary_sample,
    )
    db.commit()
    return PublicationMetricTransformSummary(
        status="success",
        source=source.code,
        date_from=date_from,
        date_to=date_to,
        slice_count=len(transformed),
        publication_count=sum(row.publication_count for row in transformed),
        salary_disclosed_count=sum(row.salary_disclosed_count for row in transformed),
        midpoint_sample_size=sum(row.midpoint_sample_size for row in transformed),
        deleted_stale_slices=max(int(getattr(deleted, "rowcount", 0) or 0), 0),
    )


def refresh_observed_publication_metrics(
    db: Session,
    *,
    source_code: str = "trudvsem_open",
    date_from: date | None = None,
    date_to: date | None = None,
    overlap_days: int = 7,
    min_salary_sample: int | None = None,
) -> PublicationMetricTransformSummary:
    """Refresh changed publication-date partitions without touching prepared metrics."""
    if overlap_days < 1:
        raise ValueError("overlap_days must be at least 1")
    sample_gate = (
        settings.min_salary_sample if min_salary_sample is None else min_salary_sample
    )
    if sample_gate < 1:
        raise ValueError("min_salary_sample must be at least 1")
    source = db.scalar(select(VacancySource).where(VacancySource.code == source_code))
    if source is None:
        return _skipped(source_code, reason="source_not_found")
    earliest_at, latest_at = db.execute(
        select(func.min(Vacancy.published_at), func.max(Vacancy.published_at)).where(
            Vacancy.source_id == source.id,
            Vacancy.profession_id.is_not(None),
        )
    ).one()
    if earliest_at is None or latest_at is None:
        return _skipped(source.code, reason="no_classified_publications")
    earliest = earliest_at.date()
    latest = latest_at.date()
    end = min(date_to or latest, latest)
    last_materialized = db.scalar(
        select(func.max(ObservedPublicationMetricDaily.metric_date)).where(
            ObservedPublicationMetricDaily.source_id == source.id
        )
    )
    if date_from is not None:
        start = max(date_from, earliest)
    elif last_materialized is not None:
        start = max(earliest, last_materialized - timedelta(days=overlap_days - 1))
    else:
        start = earliest
    if start > end:
        return _skipped(source.code, reason="empty_date_window", date_from=start, date_to=end)

    start_at = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_at = datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone.utc)
    expected_publications = int(
        db.scalar(
            select(func.count(Vacancy.id)).where(
                Vacancy.source_id == source.id,
                Vacancy.profession_id.is_not(None),
                Vacancy.published_at >= start_at,
                Vacancy.published_at < end_at,
            )
        )
        or 0
    )
    if expected_publications == 0:
        return _skipped(
            source.code,
            reason="no_classified_publications_in_window",
            date_from=start,
            date_to=end,
        )
    run_id = str(uuid4())
    try:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            return _postgres_refresh(
                db,
                source=source,
                date_from=start,
                date_to=end,
                run_id=run_id,
                expected_publications=expected_publications,
                min_salary_sample=sample_gate,
            )
        return _portable_refresh(
            db,
            source=source,
            date_from=start,
            date_to=end,
            run_id=run_id,
            expected_publications=expected_publications,
            min_salary_sample=sample_gate,
        )
    except Exception:
        db.rollback()
        raise
