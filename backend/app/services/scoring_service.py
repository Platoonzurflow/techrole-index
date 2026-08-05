from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal
from statistics import median

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.data.salary_benchmarks import scoring_salary_benchmark
from app.domain.scoring import SCORING_VERSION, ScoreInputs, calculate_score
from app.domain.trends import calculate_trend
from app.models import (
    Profession,
    ProfessionCategory,
    ProfessionMetricDaily,
    ProfessionScoreDaily,
    Region,
    ScoringVersion,
    SeniorityLevel,
    Vacancy,
    VacancySource,
)

HH_MIN_PROFESSION_SAMPLE = 5
HH_MIN_SALARY_SAMPLE = 5


def _hh_score_dataset(
    db: Session,
) -> tuple[date, dict[int, ScoreInputs], list[float]] | None:
    """Build one comparable score input row from each profession's own HH records.

    No category vacancy counts, salary rows, remote shares or experience shares are
    borrowed. When fewer than five exact gross RUB salary midpoints are available,
    salary gets the neutral median of eligible peers so missing disclosure cannot
    create either a reward or a penalty; data quality still records the small sample.
    """

    source_id = db.scalar(
        select(VacancySource.id).where(
            VacancySource.code == "hh_api", VacancySource.enabled.is_(True)
        )
    )
    latest_at = db.scalar(
        select(func.max(Vacancy.published_at)).where(
            Vacancy.source_id == source_id,
            Vacancy.profession_id.is_not(None),
        )
    ) if source_id is not None else None
    if source_id is None or latest_at is None:
        return None

    score_date = latest_at.date()
    start_date = score_date - timedelta(days=max(settings.hh_history_days, 14) - 1)
    rows = db.scalars(
        select(Vacancy).where(
            Vacancy.source_id == source_id,
            Vacancy.profession_id.is_not(None),
            Vacancy.published_at >= start_date,
            Vacancy.published_at < score_date + timedelta(days=1),
        )
    ).all()
    grouped: dict[int, list[Vacancy]] = defaultdict(list)
    for row in rows:
        if row.profession_id is not None:
            grouped[row.profession_id].append(row)

    contexts = db.execute(
        select(Profession.id, Profession.slug, ProfessionCategory.slug)
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .where(Profession.is_active.is_(True))
        .order_by(Profession.id)
    ).all()
    own_salary_medians: dict[int, float] = {}
    for profession_id, profession_rows in grouped.items():
        midpoints = [
            float((row.salary_from + row.salary_to) / 2)
            for row in profession_rows
            if row.currency == "RUB"
            and row.salary_gross is True
            and row.salary_from is not None
            and row.salary_to is not None
        ]
        if len(midpoints) >= HH_MIN_SALARY_SAMPLE:
            own_salary_medians[profession_id] = float(median(midpoints))

    eligible_salary_peers = list(own_salary_medians.values())
    if eligible_salary_peers:
        neutral_salary = float(median(eligible_salary_peers))
    else:
        neutral_salary = float(
            median(
                scoring_salary_benchmark(slug, category_slug)
                for _, slug, category_slug in contexts
            )
        )

    prepared: dict[int, ScoreInputs] = {}
    for profession_id, _, _ in contexts:
        profession_rows = grouped.get(profession_id, [])
        total = len(profession_rows)
        daily = Counter(row.published_at.date() for row in profession_rows)
        daily_values: list[float | None] = [
            float(daily.get(score_date - timedelta(days=offset), 0))
            for offset in range(13, -1, -1)
        ]
        growth = calculate_trend(daily_values, 7).change_percent
        disclosed = sum(
            1
            for row in profession_rows
            if row.currency and (row.salary_from is not None or row.salary_to is not None)
        )
        junior = sum(
            1
            for row in profession_rows
            if str(row.experience_code or "").casefold()
            in {"noexperience", "no_experience"}
        )
        remote = sum(1 for row in profession_rows if row.is_remote)
        prepared[profession_id] = ScoreInputs(
            vacancy_count=float(total),
            salary_median=own_salary_medians.get(profession_id, neutral_salary),
            demand_growth_percent=(growth or 0.0)
            if total >= HH_MIN_PROFESSION_SAMPLE
            else 0.0,
            junior_share=junior / total if total else 0.0,
            remote_share=remote / total if total else 0.0,
            salary_coverage=disclosed / total if total else 0.0,
            sample_size=total,
        )
    return score_date, prepared, eligible_salary_peers or [neutral_salary]


def _prepared_score_dataset(
    db: Session,
) -> tuple[date, dict[int, ScoreInputs], list[float]] | None:
    score_date = db.scalar(select(func.max(ProfessionMetricDaily.metric_date)))
    region_id = db.scalar(select(Region.id).where(Region.code == "ru"))
    if score_date is None or region_id is None:
        return None
    rows = db.execute(
        select(ProfessionMetricDaily, SeniorityLevel.code)
        .join(SeniorityLevel, ProfessionMetricDaily.seniority_id == SeniorityLevel.id)
        .join(Profession, ProfessionMetricDaily.profession_id == Profession.id)
        .where(
            ProfessionMetricDaily.metric_date == score_date,
            ProfessionMetricDaily.region_id == region_id,
            ProfessionMetricDaily.gross.is_(True),
            Profession.is_active.is_(True),
        )
    ).all()
    by_profession: dict[int, dict[str, ProfessionMetricDaily]] = defaultdict(dict)
    for metric, level_code in rows:
        by_profession[metric.profession_id][level_code] = metric
    profession_context = {
        profession_id: (slug, category_slug)
        for profession_id, slug, category_slug in db.execute(
            select(Profession.id, Profession.slug, ProfessionCategory.slug)
            .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
            .where(Profession.is_active.is_(True))
        ).all()
    }
    prepared: dict[int, ScoreInputs] = {}
    for profession_id, levels in by_profession.items():
        history = db.execute(
            select(
                ProfessionMetricDaily.metric_date,
                func.sum(ProfessionMetricDaily.vacancy_count),
            )
            .where(
                ProfessionMetricDaily.profession_id == profession_id,
                ProfessionMetricDaily.region_id == region_id,
                ProfessionMetricDaily.gross.is_(True),
                ProfessionMetricDaily.metric_date >= score_date - timedelta(days=13),
            )
            .group_by(ProfessionMetricDaily.metric_date)
            .order_by(ProfessionMetricDaily.metric_date)
        ).all()
        growth = calculate_trend([float(value) for _, value in history], 7).change_percent or 0.0
        total_vacancies = sum(item.vacancy_count for item in levels.values())
        total_salary = sum(item.salary_count for item in levels.values())
        junior = levels.get("junior")
        slug, category_slug = profession_context[profession_id]
        prepared[profession_id] = ScoreInputs(
            vacancy_count=float(total_vacancies),
            salary_median=scoring_salary_benchmark(slug, category_slug),
            demand_growth_percent=growth,
            junior_share=(junior.vacancy_count / total_vacancies)
            if junior and total_vacancies
            else 0,
            remote_share=(
                sum(float(item.remote_share) * item.vacancy_count for item in levels.values())
                / total_vacancies
                if total_vacancies
                else 0
            ),
            salary_coverage=total_salary / total_vacancies if total_vacancies else 0,
            sample_size=sum(item.sample_size for item in levels.values()),
        )
    return score_date, prepared, [item.salary_median for item in prepared.values()]


def recompute_scores(db: Session) -> int:
    version = db.scalar(
        select(ScoringVersion)
        .where(ScoringVersion.is_active.is_(True))
        .order_by(ScoringVersion.created_at.desc())
    )
    if version is None:
        return 0
    dataset = (
        _hh_score_dataset(db)
        if version.version == SCORING_VERSION
        else None
    ) or _prepared_score_dataset(db)
    if dataset is None:
        return 0
    score_date, prepared, salary_peers = dataset
    demand_peers = [item.vacancy_count for item in prepared.values()]
    growth_peers = [item.demand_growth_percent for item in prepared.values()]
    for profession_id, inputs in prepared.items():
        result = calculate_score(
            inputs,
            demand_peers=demand_peers,
            salary_peers=salary_peers,
            growth_peers=growth_peers,
            weights=version.weights,
            version=version.version,
        )
        stored = db.scalar(
            select(ProfessionScoreDaily).where(
                ProfessionScoreDaily.score_date == score_date,
                ProfessionScoreDaily.profession_id == profession_id,
                ProfessionScoreDaily.scoring_version_id == version.id,
            )
        )
        if stored is None:
            stored = ProfessionScoreDaily(
                score_date=score_date,
                profession_id=profession_id,
                scoring_version_id=version.id,
                score=result.score,
                breakdown=result.breakdown,
                data_confidence=result.data_confidence,
            )
            db.add(stored)
        else:
            stored.score = Decimal(str(result.score))
            stored.breakdown = result.breakdown
            stored.data_confidence = result.data_confidence
    db.commit()
    return len(prepared)
