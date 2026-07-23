from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import fmean
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.data.salary_benchmarks import salary_benchmark_catalog, salary_benchmark_for
from app.data.tech_stacks import tech_stack_for
from app.database import get_db
from app.domain.salary import SalaryInput, calculate_salary_statistics
from app.domain.time_windows import utc_calendar_window
from app.domain.trends import Trend, calculate_all_trends, calculate_trend
from app.models import (
    Profession,
    ProfessionCategory,
    ProfessionMetricDaily,
    ProfessionScoreDaily,
    Region,
    ScoringVersion,
    SeniorityLevel,
    Vacancy,
    VacancySkill,
    VacancySource,
)
from app.schemas import (
    MetricPoint,
    OfficialOpenDataSummary,
    OfficialSalaryHistoryPoint,
    OfficialSalarySlice,
    OpenDataCatalogItem,
    ProfessionDetail,
    ProfessionSummary,
    PublicationPoint,
    SalaryBenchmarkCatalogItem,
    TrendOut,
)
from app.security import has_premium, optional_user, require_premium
from app.services.cache import RedisJsonCache

router = APIRouter(tags=["professions"])
profession_cache = RedisJsonCache(
    enabled=settings.catalog_cache_enabled,
    redis_url=settings.redis_url,
    ttl_seconds=settings.catalog_cache_ttl_seconds,
)


@router.get(
    "/salary-benchmarks",
    response_model=list[SalaryBenchmarkCatalogItem],
    response_model_exclude_none=True,
)
def salary_benchmarks():
    return salary_benchmark_catalog()


@router.get(
    "/open-data/publications",
    response_model=list[OpenDataCatalogItem],
    response_model_exclude_none=True,
)
def open_data_publications(db: Session = Depends(get_db)):
    period_days = 180
    now = datetime.now(timezone.utc)
    window = utc_calendar_window(now, days=period_days)
    date_to = window.date_to
    date_from = window.date_from
    source_id = db.scalar(select(VacancySource.id).where(VacancySource.code == "trudvsem_open"))
    if source_id is None:
        return []
    rows = db.execute(
        select(
            Profession.id,
            Profession.slug,
            Profession.name_ru,
            ProfessionCategory.slug,
            func.count(Vacancy.id),
            func.max(Vacancy.last_seen_at),
        )
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .outerjoin(
            Vacancy,
            (Vacancy.profession_id == Profession.id)
            & (Vacancy.source_id == source_id)
            & (Vacancy.published_at >= window.start_at)
            & (Vacancy.published_at < window.end_at_exclusive),
        )
        .where(Profession.is_active.is_(True))
        .group_by(Profession.id, ProfessionCategory.slug)
        .order_by(Profession.name_ru)
    ).all()
    publications: list[OpenDataCatalogItem] = []
    for profession_id, slug, name_ru, category_slug, total, last_ingested_at in rows:
        official = _official_open_data_summary(db, profession_id, period_days)
        publications.append(
            OpenDataCatalogItem(
                slug=slug,
                name_ru=name_ru,
                category_slug=category_slug,
                period_days=period_days,
                date_from=date_from,
                date_to=date_to,
                total_publications=int(total or 0),
                last_ingested_at=last_ingested_at,
                salary_currency=official.salary_currency,
                salary_gross_status=official.salary_gross_status,
                salary_min_sample=official.salary_min_sample,
                salary_by_seniority=official.salary_by_seniority,
            )
        )
    return publications


def _latest_score_date(db: Session):
    return db.scalar(select(func.max(ProfessionScoreDaily.score_date)))


def _official_open_data_summary(
    db: Session,
    profession_id: int,
    period_days: int = 180,
    *,
    include_category_context: bool = False,
) -> OfficialOpenDataSummary:
    now = datetime.now(timezone.utc)
    window = utc_calendar_window(now, days=period_days)
    date_to = window.date_to
    date_from = window.date_from
    source_id = db.scalar(select(VacancySource.id).where(VacancySource.code == "trudvsem_open"))
    rows: list[tuple[Any, ...]] = []
    if source_id is not None:
        rows = [
            tuple(row)
            for row in db.execute(
                select(
                    Vacancy.published_at,
                    Vacancy.salary_from,
                    Vacancy.salary_to,
                    Vacancy.is_remote,
                    Vacancy.last_seen_at,
                    Vacancy.currency,
                    SeniorityLevel.code,
                )
                .outerjoin(SeniorityLevel, Vacancy.seniority_id == SeniorityLevel.id)
                .where(
                    Vacancy.source_id == source_id,
                    Vacancy.profession_id == profession_id,
                    Vacancy.published_at >= window.start_at,
                    Vacancy.published_at < window.end_at_exclusive,
                )
            ).all()
        ]
    daily = {date_from + timedelta(days=index): 0 for index in range(period_days)}
    category_daily = {date_from + timedelta(days=index): 0 for index in range(period_days)}
    salary_disclosed_count = remote_count = 0
    category_salary_disclosed_count = category_remote_count = 0
    last_ingested_at = None
    salary_rows: dict[str, list[tuple[Any, ...]]] = {
        "junior": [],
        "middle": [],
        "senior": [],
    }
    for (
        published_at,
        salary_from,
        salary_to,
        is_remote,
        last_seen_at,
        currency,
        seniority_code,
    ) in rows:
        published_date = published_at.date()
        if published_date in daily:
            daily[published_date] += 1
        salary_disclosed_count += int(salary_from is not None or salary_to is not None)
        remote_count += int(is_remote)
        if last_seen_at is not None:
            last_ingested_at = max(last_ingested_at or last_seen_at, last_seen_at)
        if seniority_code in salary_rows:
            salary_rows[seniority_code].append(
                (
                    published_at,
                    salary_from if currency == "RUB" else None,
                    salary_to if currency == "RUB" else None,
                )
            )
    total = len(rows)
    category_total = 0
    category_salary_rows: dict[str, list[tuple[Any, ...]]] = {
        "junior": [],
        "middle": [],
        "senior": [],
    }
    if include_category_context and source_id is not None:
        category_id = db.scalar(
            select(Profession.category_id).where(Profession.id == profession_id)
        )
        if category_id is not None:
            category_rows = db.execute(
                select(
                    Vacancy.published_at,
                    Vacancy.salary_from,
                    Vacancy.salary_to,
                    Vacancy.is_remote,
                    Vacancy.currency,
                    SeniorityLevel.code,
                )
                .join(Profession, Vacancy.profession_id == Profession.id)
                .outerjoin(SeniorityLevel, Vacancy.seniority_id == SeniorityLevel.id)
                .where(
                    Vacancy.source_id == source_id,
                    Profession.category_id == category_id,
                    Vacancy.published_at >= window.start_at,
                    Vacancy.published_at < window.end_at_exclusive,
                )
            ).all()
            category_total = len(category_rows)
            for (
                published_at,
                salary_from,
                salary_to,
                is_remote,
                currency,
                seniority_code,
            ) in category_rows:
                published_date = published_at.date()
                if published_date in category_daily:
                    category_daily[published_date] += 1
                category_salary_disclosed_count += int(
                    salary_from is not None or salary_to is not None
                )
                category_remote_count += int(is_remote)
                if seniority_code in category_salary_rows:
                    category_salary_rows[seniority_code].append(
                        (
                            published_at,
                            salary_from if currency == "RUB" else None,
                            salary_to if currency == "RUB" else None,
                        )
                    )
    confidence = (
        "high"
        if total >= 100
        else "medium"
        if total >= 20
        else "low"
        if total > 0
        else "insufficient"
    )
    def build_salary_slices(
        grouped_rows: dict[str, list[tuple[Any, ...]]],
    ) -> list[OfficialSalarySlice]:
        slices: list[OfficialSalarySlice] = []
        for seniority_code in ("junior", "middle", "senior"):
            level_rows = grouped_rows[seniority_code]
            stats = calculate_salary_statistics(
                [
                    SalaryInput(lower=salary_from, upper=salary_to, gross=None)
                    for _, salary_from, salary_to in level_rows
                ],
                total_vacancies=len(level_rows),
                min_sample=settings.min_salary_sample,
                gross=None,
            )
            slices.append(
                OfficialSalarySlice(
                    seniority=seniority_code,
                    vacancy_count=stats.vacancy_count,
                    salary_count=stats.salary_count,
                    salary_coverage=stats.salary_coverage,
                    sample_size=stats.midpoint_sample_size,
                    median=stats.median,
                    average=stats.average,
                    p25=stats.p25,
                    p75=stats.p75,
                    lower_bound_median=(
                        stats.lower_bound_median
                        if stats.midpoint_sample_size >= settings.min_salary_sample
                        else None
                    ),
                    upper_bound_median=(
                        stats.upper_bound_median
                        if stats.midpoint_sample_size >= settings.min_salary_sample
                        else None
                    ),
                    confidence_level=stats.confidence_level,
                )
            )
        return slices

    salary_by_seniority = build_salary_slices(salary_rows)
    category_salary_by_seniority = build_salary_slices(category_salary_rows)
    category_confidence = (
        "high"
        if category_total >= 100
        else "medium"
        if category_total >= 20
        else "low"
        if category_total > 0
        else "insufficient"
    )

    salary_history: list[OfficialSalaryHistoryPoint] = []
    history_date = date_from + timedelta(days=29)
    while history_date <= date_to:
        window_start = history_date - timedelta(days=29)
        for seniority_code in ("junior", "middle", "senior"):
            window_rows = [
                (salary_from, salary_to)
                for published_at, salary_from, salary_to in salary_rows[seniority_code]
                if window_start <= published_at.date() <= history_date
            ]
            window_stats = calculate_salary_statistics(
                [
                    SalaryInput(lower=salary_from, upper=salary_to, gross=None)
                    for salary_from, salary_to in window_rows
                ],
                total_vacancies=len(window_rows),
                min_sample=settings.min_salary_sample,
                gross=None,
            )
            salary_history.append(
                OfficialSalaryHistoryPoint(
                    date=history_date,
                    seniority=seniority_code,
                    median=window_stats.median,
                    sample_size=window_stats.midpoint_sample_size,
                )
            )
        history_date += timedelta(days=7)

    return OfficialOpenDataSummary(
        source_name="Работа России - официальный открытый API",
        source_url="https://trudvsem.ru/opendata/api",
        period_days=period_days,
        date_from=date_from,
        date_to=date_to,
        total_publications=total,
        salary_disclosed_count=salary_disclosed_count,
        remote_count=remote_count,
        confidence_level=confidence,
        last_ingested_at=last_ingested_at,
        daily_publications=[
            PublicationPoint(date=metric_date, count=count) for metric_date, count in daily.items()
        ],
        category_total_publications=category_total,
        category_daily_publications=[
            PublicationPoint(date=metric_date, count=count)
            for metric_date, count in category_daily.items()
        ],
        category_salary_disclosed_count=category_salary_disclosed_count,
        category_remote_count=category_remote_count,
        category_confidence_level=category_confidence,
        category_salary_by_seniority=category_salary_by_seniority,
        salary_currency="RUB",
        salary_gross_status="unknown",
        salary_min_sample=settings.min_salary_sample,
        salary_by_seniority=salary_by_seniority,
        salary_history=salary_history,
        salary_methodology_note=(
            "Статистика рассчитана только по RUB-записям с двумя границами вилки. "
            "Каждая точка истории использует предшествующее 30-дневное окно; "
            "gross/net источником не определён. Значения публикуются только при "
            f"выборке не менее {settings.min_salary_sample}."
        ),
        methodology_note=(
            "Количество найденных публикаций по дате создания записи. Это не историческое "
            "число одновременно активных вакансий; gross/net источником не определён."
        ),
    )


def _summary_rows(db: Session):
    score_date = _latest_score_date(db)
    statement = (
        select(Profession, ProfessionCategory, ProfessionScoreDaily)
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .outerjoin(
            ProfessionScoreDaily,
            (ProfessionScoreDaily.profession_id == Profession.id)
            & (ProfessionScoreDaily.score_date == score_date),
        )
        .where(Profession.is_active.is_(True))
        .order_by(Profession.name_ru)
    )
    return db.execute(statement).all()


def _summary(
    profession,
    category,
    score,
    premium: bool,
    *,
    ranking_teaser: bool = False,
    weekly_trend: Trend | None = None,
) -> ProfessionSummary:
    teaser = profession.is_premium and not premium and not ranking_teaser
    return ProfessionSummary(
        id=profession.id,
        slug=profession.slug,
        name_ru=profession.name_ru,
        name_en=profession.name_en,
        description=profession.description,
        category_slug=category.slug,
        category_name=category.name_ru,
        is_premium=profession.is_premium,
        teaser_only=teaser,
        score=None if teaser or score is None else float(score.score),
        data_confidence=None if teaser or score is None else score.data_confidence,
        weekly_change_percent=weekly_trend.change_percent if weekly_trend else None,
        weekly_direction=weekly_trend.direction if weekly_trend else None,
    )


def _weekly_demand_trends(db: Session) -> dict[int, Trend]:
    national_id = db.scalar(select(Region.id).where(Region.code == "ru"))
    max_date = db.scalar(
        select(func.max(ProfessionMetricDaily.metric_date)).where(
            ProfessionMetricDaily.region_id == national_id,
            ProfessionMetricDaily.gross.is_(True),
        )
    )
    if national_id is None or max_date is None:
        return {}
    start_date = max_date - timedelta(days=13)
    rows = db.execute(
        select(
            ProfessionMetricDaily.profession_id,
            ProfessionMetricDaily.metric_date,
            func.sum(ProfessionMetricDaily.vacancy_count),
        )
        .where(
            ProfessionMetricDaily.region_id == national_id,
            ProfessionMetricDaily.gross.is_(True),
            ProfessionMetricDaily.metric_date >= start_date,
        )
        .group_by(
            ProfessionMetricDaily.profession_id,
            ProfessionMetricDaily.metric_date,
        )
    ).all()
    by_profession: dict[int, dict] = defaultdict(dict)
    for profession_id, metric_date, vacancy_count in rows:
        by_profession[profession_id][metric_date] = float(vacancy_count or 0)
    dates = [start_date + timedelta(days=offset) for offset in range(14)]
    return {
        profession_id: calculate_trend([values.get(item) for item in dates], 7)
        for profession_id, values in by_profession.items()
    }


@router.get(
    "/professions", response_model=list[ProfessionSummary], response_model_exclude_none=True
)
def list_professions(
    category: str | None = None,
    query: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
    user=Depends(optional_user),
):
    premium = has_premium(db, user)
    cache_parts = {
        "tier": "premium" if premium else "public",
        "category": category,
        "query": query,
    }
    cached = profession_cache.get("catalog", cache_parts)
    if isinstance(cached, list):
        try:
            return [ProfessionSummary.model_validate(item) for item in cached]
        except ValidationError:
            pass
    result = []
    for profession, profession_category, score in _summary_rows(db):
        if category and profession_category.slug != category:
            continue
        if query and query.lower() not in f"{profession.name_ru} {profession.name_en}".lower():
            continue
        result.append(_summary(profession, profession_category, score, premium))
    profession_cache.set(
        "catalog",
        cache_parts,
        [item.model_dump(mode="json") for item in result],
    )
    return result


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    count_rows = db.execute(
        select(Profession.category_id, func.count(Profession.id))
        .where(Profession.is_active.is_(True))
        .group_by(Profession.category_id)
    ).tuples()
    counts: dict[int, int] = {category_id: count for category_id, count in count_rows}
    return [
        {
            "slug": item.slug,
            "name": item.name_ru,
            "description": item.description,
            "profession_count": counts.get(item.id, 0),
        }
        for item in db.scalars(
            select(ProfessionCategory).order_by(ProfessionCategory.name_ru)
        ).all()
    ]


def build_detail(db: Session, slug: str, user, days: int = 30) -> ProfessionDetail:
    score_date = _latest_score_date(db)
    row = db.execute(
        select(Profession, ProfessionCategory, ProfessionScoreDaily, ScoringVersion)
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .outerjoin(
            ProfessionScoreDaily,
            (ProfessionScoreDaily.profession_id == Profession.id)
            & (ProfessionScoreDaily.score_date == score_date),
        )
        .outerjoin(ScoringVersion, ProfessionScoreDaily.scoring_version_id == ScoringVersion.id)
        .where(Profession.slug == slug, Profession.is_active.is_(True))
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Профессия не найдена")
    profession, category, score, scoring_version = row
    premium = has_premium(db, user)
    summary = _summary(profession, category, score, premium)
    tech_stack = tech_stack_for(profession.slug)
    official_open_data = _official_open_data_summary(
        db,
        profession.id,
        include_category_context=True,
    )
    salary_benchmark = salary_benchmark_for(profession.slug, category.slug)
    if summary.teaser_only:
        return ProfessionDetail(
            **summary.model_dump(),
            tech_stack=tech_stack,
            official_open_data=official_open_data,
            salary_benchmark=salary_benchmark,
        )

    history_days = min(days, 180 if premium else 30)
    national_id = db.scalar(select(Region.id).where(Region.code == "ru"))
    max_date = db.scalar(
        select(func.max(ProfessionMetricDaily.metric_date)).where(
            ProfessionMetricDaily.profession_id == profession.id,
            ProfessionMetricDaily.region_id == national_id,
        )
    )
    if max_date is None:
        return ProfessionDetail(
            **summary.model_dump(),
            tech_stack=tech_stack,
            official_open_data=official_open_data,
            salary_benchmark=salary_benchmark,
        )
    start_date = max_date - timedelta(days=history_days - 1)
    metric_rows = db.execute(
        select(ProfessionMetricDaily, SeniorityLevel)
        .join(SeniorityLevel, ProfessionMetricDaily.seniority_id == SeniorityLevel.id)
        .where(
            ProfessionMetricDaily.profession_id == profession.id,
            ProfessionMetricDaily.region_id == national_id,
            ProfessionMetricDaily.metric_date >= start_date,
            ProfessionMetricDaily.gross.is_(True),
        )
        .order_by(ProfessionMetricDaily.metric_date, SeniorityLevel.sort_order)
    ).all()
    metrics = [
        MetricPoint(
            date=metric.metric_date,
            seniority=level.code,
            vacancy_count=metric.vacancy_count,
            salary_count=metric.salary_count,
            salary_coverage=float(metric.salary_coverage),
            salary_median=float(metric.salary_median) if metric.salary_median is not None else None,
            salary_average=float(metric.salary_average)
            if metric.salary_average is not None
            else None,
            salary_p25=float(metric.salary_p25) if metric.salary_p25 is not None else None,
            salary_p75=float(metric.salary_p75) if metric.salary_p75 is not None else None,
            lower_bound_median=float(metric.lower_bound_median)
            if metric.lower_bound_median is not None
            else None,
            upper_bound_median=float(metric.upper_bound_median)
            if metric.upper_bound_median is not None
            else None,
            sample_size=metric.sample_size,
            confidence_level=metric.confidence_level,
            remote_share=float(metric.remote_share),
        )
        for metric, level in metric_rows
    ]

    full_rows = db.execute(
        select(
            ProfessionMetricDaily.metric_date,
            ProfessionMetricDaily.vacancy_count,
            ProfessionMetricDaily.salary_median,
        )
        .where(
            ProfessionMetricDaily.profession_id == profession.id,
            ProfessionMetricDaily.region_id == national_id,
            ProfessionMetricDaily.metric_date >= max_date - timedelta(days=179),
            ProfessionMetricDaily.gross.is_(True),
        )
        .order_by(ProfessionMetricDaily.metric_date)
    ).all()
    by_date: dict = defaultdict(lambda: {"vacancies": 0, "salaries": []})
    for metric_date, vacancy_count, salary_median in full_rows:
        by_date[metric_date]["vacancies"] += vacancy_count
        if salary_median is not None:
            by_date[metric_date]["salaries"].append(float(salary_median))
    ordered_dates = sorted(by_date)
    vacancy_trends = calculate_all_trends([by_date[item]["vacancies"] for item in ordered_dates])
    salary_trends = calculate_all_trends(
        [
            fmean(by_date[item]["salaries"]) if by_date[item]["salaries"] else None
            for item in ordered_dates
        ]
    )

    skill_rows = db.execute(
        select(VacancySkill.skill, func.count(VacancySkill.id))
        .join(Vacancy, VacancySkill.vacancy_id == Vacancy.id)
        .where(Vacancy.profession_id == profession.id)
        .group_by(VacancySkill.skill)
        .order_by(desc(func.count(VacancySkill.id)))
        .limit(10)
    ).all()
    current_region_rows = db.execute(
        select(Region.name_ru, func.sum(ProfessionMetricDaily.vacancy_count))
        .join(ProfessionMetricDaily, ProfessionMetricDaily.region_id == Region.id)
        .where(
            ProfessionMetricDaily.profession_id == profession.id,
            ProfessionMetricDaily.metric_date == max_date,
            Region.code != "ru",
        )
        .group_by(Region.name_ru)
        .order_by(desc(func.sum(ProfessionMetricDaily.vacancy_count)))
    ).all()

    def to_trends(trends):
        return {
            key: TrendOut(
                period_days=value.period_days,
                change_percent=value.change_percent,
                direction=value.direction,
            )
            for key, value in trends.items()
        }

    return ProfessionDetail(
        **summary.model_dump(),
        updated_at=max_date,
        scoring_version=scoring_version.version if scoring_version else None,
        score_breakdown=score.breakdown if score else None,
        score_weights=(
            {key: float(value) for key, value in scoring_version.weights.items()}
            if score and scoring_version
            else None
        ),
        score_contributions=(
            {
                key: round(float(component) * float(scoring_version.weights.get(key, 0)), 1)
                for key, component in score.breakdown.items()
            }
            if score and scoring_version
            else None
        ),
        metrics=metrics,
        vacancy_trends=to_trends(vacancy_trends),
        salary_trends=to_trends(salary_trends),
        skills=[{"name": name, "count": count} for name, count in skill_rows],
        regions=[
            {"name": name, "vacancy_count": int(count or 0)} for name, count in current_region_rows
        ],
        tech_stack=tech_stack,
        history_days=history_days,
        official_open_data=official_open_data,
        salary_benchmark=salary_benchmark,
    )


@router.get(
    "/professions/{slug}", response_model=ProfessionDetail, response_model_exclude_none=True
)
def get_profession(
    slug: str,
    days: int = Query(default=30, ge=7, le=180),
    db: Session = Depends(get_db),
    user=Depends(optional_user),
):
    premium = has_premium(db, user)
    effective_days = min(days, 180 if premium else 30)
    cache_parts = {
        "schema": "salary-benchmark-v3",
        "tier": "premium" if premium else "public",
        "slug": slug,
        "days": effective_days,
    }
    cached = profession_cache.get("detail", cache_parts)
    if isinstance(cached, dict):
        try:
            return ProfessionDetail.model_validate(cached)
        except ValidationError:
            pass
    detail = build_detail(db, slug, user, days)
    profession_cache.set("detail", cache_parts, detail.model_dump(mode="json"))
    return detail


@router.get("/ranking", response_model=list[ProfessionSummary], response_model_exclude_none=True)
def ranking(db: Session = Depends(get_db), user=Depends(optional_user)):
    premium = has_premium(db, user)
    weekly_trends = _weekly_demand_trends(db)
    rows = sorted(
        _summary_rows(db), key=lambda row: float(row[2].score) if row[2] else -1, reverse=True
    )
    if not premium:
        rows = rows[:3]
    return [
        _summary(
            profession,
            category,
            score,
            premium,
            ranking_teaser=not premium,
            weekly_trend=weekly_trends.get(profession.id),
        )
        for profession, category, score in rows
    ]


@router.get("/compare", response_model=list[ProfessionDetail], response_model_exclude_none=True)
def compare(
    slugs: str = Query(min_length=3, max_length=400),
    db: Session = Depends(get_db),
    user=Depends(require_premium),
):
    requested = list(dict.fromkeys(item.strip() for item in slugs.split(",") if item.strip()))
    if not 2 <= len(requested) <= 3:
        raise HTTPException(status_code=422, detail="Выберите две или три профессии")
    return [build_detail(db, slug, user, 180) for slug in requested]


@router.get("/dashboard", response_model=list[ProfessionSummary], response_model_exclude_none=True)
def dashboard(db: Session = Depends(get_db), user=Depends(require_premium)):
    del user
    rows = sorted(
        _summary_rows(db), key=lambda row: float(row[2].score) if row[2] else -1, reverse=True
    )
    return [
        _summary(profession, category, score, True) for profession, category, score in rows[:12]
    ]
