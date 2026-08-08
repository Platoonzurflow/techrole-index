from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from statistics import fmean, median
from typing import Any, cast

from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app.config import settings
from app.data.salary_benchmarks import salary_benchmark_for
from app.domain.salary_history import (
    SALARY_HISTORY_MINIMUM_RATIO,
    salary_history_reference,
)
from app.models import (
    Profession,
    ProfessionCategory,
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


def _percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _confidence(sample_size: int, coverage: float) -> str:
    minimum = settings.min_salary_sample
    if sample_size < minimum:
        return "insufficient"
    if sample_size < minimum * 2 or coverage < 0.35:
        return "low"
    if sample_size < minimum * 5 or coverage < 0.60:
        return "medium"
    return "high"


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
    salary_floors: dict[tuple[int, int], float] = {}
    for profession_id, profession_slug, category_slug in db.execute(
        select(Profession.id, Profession.slug, ProfessionCategory.slug)
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .where(Profession.is_active.is_(True))
    ).all():
        reference, _ = salary_history_reference(
            salary_benchmark_for(profession_slug, category_slug)
        )
        for seniority_code, ratio in SALARY_HISTORY_MINIMUM_RATIO.items():
            seniority_id = seniority_ids.get(seniority_code)
            if seniority_id is not None:
                salary_floors[(profession_id, seniority_id)] = reference * ratio
    experience_seniority = {
        "noexperience": "junior",
        "between1and3": "middle",
        "between3and6": "senior",
        "morethan6": "senior",
    }

    grouped: dict[tuple[int, int, int], list[Vacancy]] = defaultdict(list)
    classified_vacancies: list[tuple[Vacancy, int]] = []
    for vacancy, profession_id in vacancy_rows:
        assert profession_id is not None
        seniority_id = vacancy.seniority_id
        if seniority_id is None and vacancy.experience_code:
            seniority_id = seniority_ids.get(
                experience_seniority.get(vacancy.experience_code.casefold(), "")
            )
        if seniority_id is None:
            continue
        classified_vacancies.append((vacancy, profession_id))
        grouped[(profession_id, seniority_id, national_region_id)].append(
            vacancy
        )
        if vacancy.region_id != national_region_id:
            grouped[(profession_id, seniority_id, vacancy.region_id)].append(
                vacancy
            )

    rows: list[dict] = []
    day_count = (date_to - date_from).days + 1
    for (profession_id, seniority_id, region_id), items in grouped.items():
        items.sort(key=lambda item: item.published_at)
        for offset in range(day_count):
            metric_date = date_from + timedelta(days=offset)
            window_from = metric_date - timedelta(days=rolling_window_days - 1)
            window = [
                item
                for item in items
                if window_from <= item.published_at.date() <= metric_date
            ]
            if not window:
                continue
            complete_salary_rows = [
                item
                for item in window
                if item.currency == "RUB"
                and item.salary_gross is True
                and item.salary_from is not None
                and item.salary_to is not None
            ]
            minimum_salary = salary_floors.get((profession_id, seniority_id), 0.0)
            salary_rows = [
                item
                for item in complete_salary_rows
                if float(
                    (cast(Decimal, item.salary_from) + cast(Decimal, item.salary_to))
                    / 2
                )
                >= minimum_salary
            ]
            midpoints = [
                float(
                    (
                        cast(Decimal, item.salary_from)
                        + cast(Decimal, item.salary_to)
                    )
                    / 2
                )
                for item in salary_rows
            ]
            lower_bounds = [float(item.salary_from) for item in salary_rows if item.salary_from]
            upper_bounds = [float(item.salary_to) for item in salary_rows if item.salary_to]
            coverage = len(salary_rows) / len(window)
            remote_count = sum(item.is_remote for item in window)
            rows.append(
                {
                    "metric_date": metric_date,
                    "profession_id": profession_id,
                    "seniority_id": seniority_id,
                    "region_id": region_id,
                    "gross": True,
                    "vacancy_count": len(window),
                    "salary_count": len(salary_rows),
                    "salary_coverage": Decimal(str(round(coverage, 5))),
                    "salary_median": Decimal(str(median(midpoints))) if midpoints else None,
                    "salary_average": Decimal(str(fmean(midpoints))) if midpoints else None,
                    "salary_p25": (
                        Decimal(str(_percentile(midpoints, 0.25))) if midpoints else None
                    ),
                    "salary_p75": (
                        Decimal(str(_percentile(midpoints, 0.75))) if midpoints else None
                    ),
                    "lower_bound_median": (
                        Decimal(str(median(lower_bounds))) if lower_bounds else None
                    ),
                    "upper_bound_median": (
                        Decimal(str(median(upper_bounds))) if upper_bounds else None
                    ),
                    "sample_size": len(salary_rows),
                    "confidence_level": _confidence(len(salary_rows), coverage),
                    "remote_share": Decimal(str(round(remote_count / len(window), 5))),
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
        vacancy_count=len(classified_vacancies),
        metric_rows=len(rows),
        profession_count=len({profession_id for _, profession_id in classified_vacancies}),
    )
