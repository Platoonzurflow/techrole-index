from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app.config import settings
from app.domain.salary_segments import SalarySegmentInput, build_ranked_salary_segments
from app.models import (
    CurrencyRateSnapshot,
    ProfessionMetricDaily,
    Region,
    SeniorityLevel,
    Vacancy,
    VacancyProfessionMatch,
    VacancySource,
)
from app.services.hh_query_matches import latest_completed_hh_query_run_id


@dataclass(frozen=True)
class HhProfessionMetricRefresh:
    source: str
    date_from: date | None
    date_to: date | None
    rolling_window_days: int
    vacancy_count: int
    metric_rows: int
    profession_count: int

    def to_dict(self) -> dict:
        return asdict(self)


def refresh_hh_profession_metrics(
    db: Session,
    *,
    rolling_window_days: int = 30,
    history_days: int | None = None,
) -> HhProfessionMetricRefresh:
    """Replace the legacy prepared series with exact profession-level HH windows."""
    if rolling_window_days < 1:
        raise ValueError("rolling_window_days must be positive")
    source = db.scalar(select(VacancySource).where(VacancySource.code == "hh_api"))
    if source is None:
        raise ValueError("Vacancy source not found: hh_api")
    match_run_id = latest_completed_hh_query_run_id(db, source.id)

    observed_statement = select(
        func.min(Vacancy.published_at), func.max(Vacancy.published_at)
    ).where(
            Vacancy.source_id == source.id,
    )
    if match_run_id is not None:
        observed_statement = observed_statement.join(
            VacancyProfessionMatch,
            VacancyProfessionMatch.vacancy_id == Vacancy.id,
        ).where(VacancyProfessionMatch.last_run_id == match_run_id)
    else:
        observed_statement = observed_statement.where(Vacancy.profession_id.is_not(None))
    observed_from, observed_to = db.execute(observed_statement).one()
    if observed_from is None or observed_to is None:
        return HhProfessionMetricRefresh(
            source="hh_api",
            date_from=None,
            date_to=None,
            rolling_window_days=rolling_window_days,
            vacancy_count=0,
            metric_rows=0,
            profession_count=0,
        )

    date_to = observed_to.date()
    available_from = observed_from.date()
    requested_history = history_days or min(settings.hh_history_days, 180)
    date_from = max(available_from, date_to - timedelta(days=requested_history - 1))
    load_from = date_from - timedelta(days=rolling_window_days - 1)
    start_at = datetime.combine(load_from, time.min, tzinfo=timezone.utc)
    end_at = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)

    vacancy_statement: Any = select(Vacancy, Vacancy.profession_id).where(
            Vacancy.source_id == source.id,
            Vacancy.profession_id.is_not(None),
            Vacancy.published_at >= start_at,
            Vacancy.published_at < end_at,
    )
    if match_run_id is not None:
        vacancy_statement = (
            select(Vacancy, VacancyProfessionMatch.profession_id)
            .join(
                VacancyProfessionMatch,
                VacancyProfessionMatch.vacancy_id == Vacancy.id,
            )
            .where(
                Vacancy.source_id == source.id,
                VacancyProfessionMatch.last_run_id == match_run_id,
                Vacancy.published_at >= start_at,
                Vacancy.published_at < end_at,
            )
        )
    vacancy_rows = db.execute(vacancy_statement).all()
    national_region_id = db.scalar(select(Region.id).where(Region.code == "ru"))
    if national_region_id is None:
        raise ValueError("National region not found: ru")
    seniority_ids = {
        item.code: item.id for item in db.scalars(select(SeniorityLevel)).all()
    }
    currency_rates: dict[str, Decimal] = {"RUB": Decimal(1)}
    for snapshot in db.scalars(
        select(CurrencyRateSnapshot).order_by(CurrencyRateSnapshot.requested_date.desc())
    ).all():
        currency_rates.setdefault(snapshot.currency, snapshot.rate_to_rub)

    def to_rub(value: Decimal | None, currency: str | None) -> Decimal | None:
        rate = currency_rates.get(str(currency or "").upper())
        return value * rate if value is not None and rate is not None else None

    grouped: dict[tuple[int, int], list[Vacancy]] = defaultdict(list)
    observed_vacancies: list[tuple[Vacancy, int]] = []
    for vacancy, profession_id in vacancy_rows:
        assert profession_id is not None
        observed_vacancies.append((vacancy, profession_id))
        grouped[(profession_id, national_region_id)].append(vacancy)
        if vacancy.region_id != national_region_id:
            grouped[(profession_id, vacancy.region_id)].append(vacancy)

    rows: list[dict] = []
    day_count = (date_to - date_from).days + 1
    for (profession_id, region_id), items in grouped.items():
        items.sort(key=lambda item: item.published_at)
        for offset in range(day_count):
            metric_date = date_from + timedelta(days=offset)
            window_from = metric_date - timedelta(days=rolling_window_days - 1)
            # The newest point represents the complete currently available HH search
            # snapshot. Earlier points remain strict rolling calendar windows. This
            # keeps the headline n exhaustive even when the API spans 31 date labels
            # around a 30-day instant cutoff.
            window = items if metric_date == date_to else [
                item
                for item in items
                if window_from <= item.published_at.date() <= metric_date
            ]
            if not window:
                continue
            remote_count = sum(item.is_remote for item in window)
            segments = build_ranked_salary_segments(
                [
                    SalarySegmentInput(
                        lower=to_rub(item.salary_from, item.currency),
                        upper=to_rub(item.salary_to, item.currency),
                        gross=item.salary_gross,
                        experience_code=item.experience_code,
                    )
                    for item in window
                ],
                minimum_sample=settings.min_salary_sample,
            )
            for segment in segments:
                seniority_id = seniority_ids.get(segment.seniority)
                if seniority_id is None:
                    continue
                coverage = (
                    segment.sample_size / segment.vacancy_count
                    if segment.vacancy_count
                    else 0.0
                )
                rows.append(
                    {
                        "metric_date": metric_date,
                        "profession_id": profession_id,
                        "seniority_id": seniority_id,
                        "region_id": region_id,
                        "gross": True,
                        "vacancy_count": segment.vacancy_count,
                        "salary_count": segment.sample_size,
                        "salary_coverage": Decimal(str(round(coverage, 5))),
                        "salary_median": (
                            Decimal(str(segment.median))
                            if segment.median is not None
                            else None
                        ),
                        "salary_average": (
                            Decimal(str(segment.average))
                            if segment.average is not None
                            else None
                        ),
                        "salary_p25": (
                            Decimal(str(segment.p25))
                            if segment.p25 is not None
                            else None
                        ),
                        "salary_p75": (
                            Decimal(str(segment.p75))
                            if segment.p75 is not None
                            else None
                        ),
                        "lower_bound_median": (
                            Decimal(str(segment.p25))
                            if segment.p25 is not None
                            else None
                        ),
                        "upper_bound_median": (
                            Decimal(str(segment.p75))
                            if segment.p75 is not None
                            else None
                        ),
                        "sample_size": segment.sample_size,
                        "confidence_level": segment.confidence_level,
                        "remote_share": Decimal(
                            str(round(remote_count / len(window), 5))
                        ),
                    }
                )

    retention_from = date_to - timedelta(days=requested_history - 1)
    db.execute(
        delete(ProfessionMetricDaily).where(
            ProfessionMetricDaily.metric_date >= date_from
        )
    )
    db.execute(
        delete(ProfessionMetricDaily).where(
            ProfessionMetricDaily.metric_date < retention_from
        )
    )
    if rows:
        db.execute(insert(ProfessionMetricDaily), rows)
    db.commit()
    return HhProfessionMetricRefresh(
        source="hh_api",
        date_from=date_from,
        date_to=date_to,
        rolling_window_days=rolling_window_days,
        vacancy_count=len(observed_vacancies),
        metric_rows=len(rows),
        profession_count=len({profession_id for _, profession_id in observed_vacancies}),
    )
