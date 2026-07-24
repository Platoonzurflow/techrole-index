from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.data.salary_benchmarks import scoring_salary_benchmark
from app.domain.scoring import ScoreInputs, calculate_score
from app.domain.trends import calculate_trend
from app.models import (
    Profession,
    ProfessionCategory,
    ProfessionMetricDaily,
    ProfessionScoreDaily,
    Region,
    ScoringVersion,
    SeniorityLevel,
)


def recompute_scores(db: Session) -> int:
    version = db.scalar(
        select(ScoringVersion)
        .where(ScoringVersion.is_active.is_(True))
        .order_by(ScoringVersion.created_at.desc())
    )
    score_date = db.scalar(select(func.max(ProfessionMetricDaily.metric_date)))
    region_id = db.scalar(select(Region.id).where(Region.code == "ru"))
    if version is None or score_date is None or region_id is None:
        return 0
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
    growth_by_profession: dict[int, float] = {}
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
        growth_by_profession[profession_id] = growth
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

    demand_peers = [item.vacancy_count for item in prepared.values()]
    salary_peers = [item.salary_median for item in prepared.values()]
    growth_peers = list(growth_by_profession.values())
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
