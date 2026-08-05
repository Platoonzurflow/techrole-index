from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import fmean
from typing import Any, Literal

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
    HhFacetCount,
    HhMarketCatalogSummary,
    HhMarketEnrichmentSummary,
    MetricPoint,
    OfficialOpenDataSummary,
    OfficialSalaryHistoryPoint,
    OfficialSalarySlice,
    OpenDataCatalogItem,
    ProfessionDetail,
    ProfessionSummary,
    PublicationPoint,
    SalaryBenchmarkCatalogItem,
    SalaryBenchmarkSummary,
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

SalaryHistorySeniority = Literal["junior", "middle", "senior"]
SalaryHistoryReferenceScope = Literal[
    "exact_role", "related_role", "technology", "category", "market_level"
]

SALARY_HISTORY_MINIMUM_RATIO: dict[SalaryHistorySeniority, float] = {
    "junior": 0.4,
    "middle": 0.7,
    "senior": 1.0,
}
SALARY_HISTORY_WINDOW_DAYS = 30
SALARY_HISTORY_MINIMUM_SOURCE_DATES = 3


def _salary_history_reference(
    benchmark: dict[str, Any],
) -> tuple[float, SalaryHistoryReferenceScope]:
    """Choose the visible national median used to trim implausibly low history points.

    The rule never changes the reference layer itself. It prefers a median for the
    exact role, then a technology or related-role median, and finally the published
    category/general-IT reference already shown on the profession page.
    """
    points = benchmark["points"]
    for scope in ("exact_role", "technology", "related_role", "category", "market_level"):
        point = next(
            (
                item
                for item in points
                if item["scope"] == scope
                and item["geography"] == "russia"
                and item["seniority"] is None
                and item["metric"] == "median"
                and item["value"] is not None
            ),
            None,
        )
        if point is not None:
            return float(point["value"]), scope
    raise ValueError("Salary benchmark has no national median reference")


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
        hh = _hh_market_summary(db, profession_id)
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
                hh_market_data=(
                    HhMarketCatalogSummary(
                        period_days=hh.period_days,
                        date_from=hh.date_from,
                        date_to=hh.date_to,
                        total_publications=hh.total_publications,
                        salary_disclosed_count=hh.salary_disclosed_count,
                        salary_gross_count=hh.salary_gross_count,
                        salary_net_count=hh.salary_net_count,
                        salary_tax_unknown_count=hh.salary_tax_unknown_count,
                        remote_count=hh.remote_count,
                        last_ingested_at=hh.last_ingested_at,
                        salary_currency=hh.salary_currency,
                        salary_min_sample=hh.salary_min_sample,
                        salary_by_seniority=hh.salary_by_seniority,
                        source_url=hh.source_url,
                        methodology_note=hh.methodology_note,
                        hh_enrichment=hh.hh_enrichment,
                    )
                    if hh is not None
                    else None
                ),
            )
        )
    return publications


def _active_scoring_version_id(db: Session) -> int | None:
    return db.scalar(
        select(ScoringVersion.id)
        .where(ScoringVersion.is_active.is_(True))
        .order_by(ScoringVersion.created_at.desc())
    )


def _latest_score_date(db: Session, scoring_version_id: int | None = None):
    version_id = scoring_version_id or _active_scoring_version_id(db)
    if version_id is None:
        return None
    return db.scalar(
        select(func.max(ProfessionScoreDaily.score_date)).where(
            ProfessionScoreDaily.scoring_version_id == version_id
        )
    )


def _source_market_summary(
    db: Session,
    profession_id: int,
    *,
    source_code: str,
    source_name: str,
    source_url: str,
    salary_gross_status: Literal["unknown", "reported_per_vacancy"],
    salary_basis: bool | None,
    salary_methodology_note: str,
    methodology_note: str,
    period_days: int = 180,
    include_category_context: bool = False,
) -> OfficialOpenDataSummary:
    profession_context = db.execute(
        select(Profession.slug, ProfessionCategory.slug, Profession.category_id)
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .where(Profession.id == profession_id)
    ).one()
    profession_slug, category_slug, category_id = profession_context
    history_reference_median, history_reference_scope = _salary_history_reference(
        salary_benchmark_for(profession_slug, category_slug)
    )
    history_minimum_salary: dict[SalaryHistorySeniority, float] = {
        seniority: history_reference_median * ratio
        for seniority, ratio in SALARY_HISTORY_MINIMUM_RATIO.items()
    }
    now = datetime.now(timezone.utc)
    window = utc_calendar_window(now, days=period_days)
    date_to = window.date_to
    date_from = window.date_from
    source_id = db.scalar(select(VacancySource.id).where(VacancySource.code == source_code))
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
                    Vacancy.salary_gross,
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
    daily_complete_salary_ranges = {
        date_from + timedelta(days=index): 0 for index in range(period_days)
    }
    category_daily = {date_from + timedelta(days=index): 0 for index in range(period_days)}
    category_daily_complete_salary_ranges = {
        date_from + timedelta(days=index): 0 for index in range(period_days)
    }
    salary_disclosed_count = remote_count = 0
    complete_salary_range_count = 0
    salary_gross_count = salary_net_count = salary_tax_unknown_count = 0
    category_salary_disclosed_count = category_remote_count = 0
    category_complete_salary_range_count = 0
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
        salary_gross,
    ) in rows:
        published_date = published_at.date()
        if published_date in daily:
            daily[published_date] += 1
        salary_disclosed_count += int(salary_from is not None or salary_to is not None)
        if salary_from is not None or salary_to is not None:
            if salary_gross is True:
                salary_gross_count += 1
            elif salary_gross is False:
                salary_net_count += 1
            else:
                salary_tax_unknown_count += 1
        has_complete_rub_range = (
            currency == "RUB" and salary_from is not None and salary_to is not None
        )
        complete_salary_range_count += int(has_complete_rub_range)
        if published_date in daily_complete_salary_ranges and has_complete_rub_range:
            daily_complete_salary_ranges[published_date] += 1
        remote_count += int(is_remote)
        if last_seen_at is not None:
            last_ingested_at = max(last_ingested_at or last_seen_at, last_seen_at)
        if seniority_code in salary_rows:
            salary_rows[seniority_code].append(
                (
                    published_at,
                    salary_from if currency == "RUB" else None,
                    salary_to if currency == "RUB" else None,
                    salary_gross,
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
        if category_id is not None:
            category_rows = db.execute(
                select(
                    Vacancy.published_at,
                    Vacancy.salary_from,
                    Vacancy.salary_to,
                    Vacancy.is_remote,
                    Vacancy.currency,
                    SeniorityLevel.code,
                    Vacancy.salary_gross,
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
                salary_gross,
            ) in category_rows:
                published_date = published_at.date()
                if published_date in category_daily:
                    category_daily[published_date] += 1
                category_salary_disclosed_count += int(
                    salary_from is not None or salary_to is not None
                )
                has_complete_rub_range = (
                    currency == "RUB" and salary_from is not None and salary_to is not None
                )
                category_complete_salary_range_count += int(has_complete_rub_range)
                if (
                    published_date in category_daily_complete_salary_ranges
                    and has_complete_rub_range
                ):
                    category_daily_complete_salary_ranges[published_date] += 1
                category_remote_count += int(is_remote)
                if seniority_code in category_salary_rows:
                    category_salary_rows[seniority_code].append(
                        (
                            published_at,
                            salary_from if currency == "RUB" else None,
                            salary_to if currency == "RUB" else None,
                            salary_gross,
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
                    SalaryInput(lower=salary_from, upper=salary_to, gross=salary_gross)
                    for _, salary_from, salary_to, salary_gross in level_rows
                ],
                total_vacancies=len(level_rows),
                min_sample=settings.min_salary_sample,
                gross=salary_basis,
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

    history_dates = [
        date_from + timedelta(days=index) for index in range(period_days)
    ]

    def fetch_history_rows(
        scope: Literal["profession", "category", "market"],
    ) -> dict[str, list[tuple[Any, ...]]]:
        grouped: dict[str, list[tuple[Any, ...]]] = {
            "junior": [],
            "middle": [],
            "senior": [],
        }
        if source_id is None:
            return grouped
        statement = (
            select(
                Vacancy.published_at,
                Vacancy.salary_from,
                Vacancy.salary_to,
                SeniorityLevel.code,
            )
            .outerjoin(SeniorityLevel, Vacancy.seniority_id == SeniorityLevel.id)
            .where(
                Vacancy.source_id == source_id,
                Vacancy.published_at
                >= window.start_at
                - timedelta(days=SALARY_HISTORY_WINDOW_DAYS - 1),
                Vacancy.published_at < window.end_at_exclusive,
                Vacancy.currency == "RUB",
                Vacancy.salary_from.is_not(None),
                Vacancy.salary_to.is_not(None),
            )
        )
        if salary_basis is not None:
            statement = statement.where(Vacancy.salary_gross.is_(salary_basis))
        if scope == "profession":
            statement = statement.where(Vacancy.profession_id == profession_id)
        elif scope == "category":
            statement = statement.join(
                Profession, Vacancy.profession_id == Profession.id
            ).where(Profession.category_id == category_id)
        else:
            statement = statement.where(Vacancy.profession_id.is_not(None))
        for published_at, salary_from, salary_to, seniority_code in db.execute(
            statement
        ).all():
            if seniority_code in grouped:
                grouped[seniority_code].append(
                    (published_at, salary_from, salary_to)
                )
        return grouped

    def build_history_candidates(
        grouped_rows: dict[str, list[tuple[Any, ...]]],
        scope: Literal["profession", "category", "market"],
    ) -> dict[str, list[OfficialSalaryHistoryPoint]]:
        candidates: dict[str, list[OfficialSalaryHistoryPoint]] = {}
        for seniority_code in ("junior", "middle", "senior"):
            points: list[OfficialSalaryHistoryPoint] = []
            for point_date in history_dates:
                window_start = point_date - timedelta(
                    days=SALARY_HISTORY_WINDOW_DAYS - 1
                )
                window_rows = [
                    (salary_from, salary_to)
                    for published_at, salary_from, salary_to in grouped_rows[seniority_code]
                    if window_start <= published_at.date() <= point_date
                    and salary_from is not None
                    and salary_to is not None
                    and float((salary_from + salary_to) / 2)
                    >= history_minimum_salary[seniority_code]
                ]
                point_stats = calculate_salary_statistics(
                    [
                        SalaryInput(lower=salary_from, upper=salary_to, gross=salary_basis)
                        for salary_from, salary_to in window_rows
                    ],
                    total_vacancies=len(window_rows),
                    min_sample=settings.min_salary_sample,
                    gross=salary_basis,
                )
                points.append(
                    OfficialSalaryHistoryPoint(
                        date=point_date,
                        seniority=seniority_code,
                        average=point_stats.average,
                        sample_size=point_stats.midpoint_sample_size,
                        scope=scope,
                    )
                )
            candidates[seniority_code] = points
        return candidates

    history_rows_by_scope: dict[
        Literal["profession", "category", "market"],
        dict[str, list[tuple[Any, ...]]],
    ] = {
        "profession": fetch_history_rows("profession"),
    }
    if include_category_context:
        history_rows_by_scope["category"] = fetch_history_rows("category")
        history_rows_by_scope["market"] = fetch_history_rows("market")
    history_candidates = {
        scope: build_history_candidates(grouped_rows, scope)
        for scope, grouped_rows in history_rows_by_scope.items()
    }
    salary_history: list[OfficialSalaryHistoryPoint] = []
    for seniority_code in SALARY_HISTORY_MINIMUM_RATIO:
        selected_points: list[OfficialSalaryHistoryPoint] | None = None
        for scope in ("profession", "category", "market"):
            grouped_rows = history_rows_by_scope.get(scope)
            candidates = history_candidates.get(scope)
            if grouped_rows is None or candidates is None:
                continue
            qualifying_dates = {
                published_at.date()
                for published_at, salary_from, salary_to in grouped_rows[seniority_code]
                if salary_from is not None
                and salary_to is not None
                and float((salary_from + salary_to) / 2)
                >= history_minimum_salary[seniority_code]
            }
            points = candidates[seniority_code]
            visible_points = sum(point.average is not None for point in points)
            if (
                visible_points >= settings.min_salary_sample
                and len(qualifying_dates) >= SALARY_HISTORY_MINIMUM_SOURCE_DATES
            ):
                selected_points = points
                break
        if selected_points is not None:
            salary_history.extend(selected_points)

    return OfficialOpenDataSummary(
        source_name=source_name,
        source_url=source_url,
        period_days=period_days,
        date_from=date_from,
        date_to=date_to,
        total_publications=total,
        salary_disclosed_count=salary_disclosed_count,
        salary_gross_count=salary_gross_count,
        salary_net_count=salary_net_count,
        salary_tax_unknown_count=salary_tax_unknown_count,
        remote_count=remote_count,
        confidence_level=confidence,
        last_ingested_at=last_ingested_at,
        daily_publications=[
            PublicationPoint(date=metric_date, count=count) for metric_date, count in daily.items()
        ],
        complete_salary_range_count=complete_salary_range_count,
        daily_complete_salary_ranges=[
            PublicationPoint(date=metric_date, count=count)
            for metric_date, count in daily_complete_salary_ranges.items()
        ],
        category_total_publications=category_total,
        category_daily_publications=[
            PublicationPoint(date=metric_date, count=count)
            for metric_date, count in category_daily.items()
        ],
        category_salary_disclosed_count=category_salary_disclosed_count,
        category_complete_salary_range_count=category_complete_salary_range_count,
        category_daily_complete_salary_ranges=[
            PublicationPoint(date=metric_date, count=count)
            for metric_date, count in category_daily_complete_salary_ranges.items()
        ],
        category_remote_count=category_remote_count,
        category_confidence_level=category_confidence,
        category_salary_by_seniority=category_salary_by_seniority,
        salary_currency="RUB",
        salary_gross_status=salary_gross_status,
        salary_min_sample=settings.min_salary_sample,
        salary_by_seniority=salary_by_seniority,
        salary_history=salary_history,
        salary_history_metric="rolling_average",
        salary_history_window_days=SALARY_HISTORY_WINDOW_DAYS,
        salary_history_reference_median=history_reference_median,
        salary_history_reference_scope=history_reference_scope,
        salary_history_minimum_ratio=SALARY_HISTORY_MINIMUM_RATIO,
        salary_history_minimum_salary=history_minimum_salary,
        salary_methodology_note=salary_methodology_note,
        methodology_note=methodology_note,
    )


def _official_open_data_summary(
    db: Session,
    profession_id: int,
    period_days: int = 180,
    *,
    include_category_context: bool = False,
) -> OfficialOpenDataSummary:
    return _source_market_summary(
        db,
        profession_id,
        source_code="trudvsem_open",
        source_name="Работа России - официальный открытый API",
        source_url="https://trudvsem.ru/opendata/api",
        salary_gross_status="unknown",
        salary_basis=None,
        period_days=period_days,
        include_category_context=include_category_context,
        salary_methodology_note=(
            "Динамика рассчитана по RUB-записям с двумя границами вилки после "
            "воспроизводимой нижней отсечки относительно видимой зарплатной медианы: "
            "40% для Junior, 70% для Middle и 100% для Senior. Каждая дневная точка "
            f"показывает среднее за предшествующие {SALARY_HISTORY_WINDOW_DAYS} дней. "
            "Для временного ряда нужны наблюдения минимум с трёх разных дат; сначала "
            "используется точная профессия, затем явно подписанное направление и общий "
            "IT-рынок. Исходные публикации и показатели полноты не фильтруются. gross/net "
            "источником не определён. Значения публикуются только при выборке не менее "
            f"{settings.min_salary_sample}."
        ),
        methodology_note=(
            "Количество найденных публикаций по дате создания записи. Это не историческое "
            "число одновременно активных вакансий; gross/net источником не определён."
        ),
    )


def _hh_market_summary(
    db: Session,
    profession_id: int,
    *,
    include_category_context: bool = False,
) -> OfficialOpenDataSummary | None:
    source = db.scalar(select(VacancySource).where(VacancySource.code == "hh_api"))
    if source is None or not source.enabled:
        return None
    summary = _source_market_summary(
        db,
        profession_id,
        source_code="hh_api",
        source_name="HeadHunter - официальный API",
        source_url=settings.hh_terms_url,
        salary_gross_status="reported_per_vacancy",
        salary_basis=True,
        period_days=settings.hh_history_days,
        include_category_context=include_category_context,
        salary_methodology_note=(
            "Зарплатные показатели рассчитаны только по вакансиям в RUB, где API явно "
            "пометил сумму как gross и указал обе границы вилки. Net и записи без признака "
            "налогообложения считаются отдельно и не смешиваются с gross. Временной ряд "
            f"использует скользящее окно {SALARY_HISTORY_WINDOW_DAYS} дней и публикуется "
            f"только при выборке не менее {settings.min_salary_sample}."
        ),
        methodology_note=(
            "Официальный поисковый снимок HH API по названию профессии и её алиасам. "
            "Результаты дедуплицированы по идентификатору вакансии и классифицированы по "
            "таксономии TechRole Index. Это не полная историческая выгрузка: API ограничивает "
            "глубину одной поисковой выдачи 2 000 результатами. Публично показываются только "
            "агрегаты без текстов вакансий, контактов и адресов. Публичные названия "
            "работодателей показываются только в агрегированном топ-5; остальные объединены "
            "в «Другие компании»."
        ),
    )
    return summary.model_copy(
        update={
            "hh_enrichment": _hh_market_enrichment_summary(
                db,
                profession_id,
                source.id,
                date_from=summary.date_from,
                date_to=summary.date_to,
            )
        }
    )


def _hh_market_enrichment_summary(
    db: Session,
    profession_id: int,
    source_id: int,
    *,
    date_from,
    date_to,
) -> HhMarketEnrichmentSummary:
    start_at = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
    end_at = datetime.combine(
        date_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
    )
    rows = db.execute(
        select(Vacancy.id, Vacancy.experience_code, Vacancy.raw_payload).where(
            Vacancy.source_id == source_id,
            Vacancy.profession_id == profession_id,
            Vacancy.published_at >= start_at,
            Vacancy.published_at < end_at,
        )
    ).all()
    total = len(rows)
    enriched = 0
    employer_counts: Counter[str] = Counter()
    employer_names: dict[str, str] = {}
    facet_counts: dict[str, Counter[tuple[str, str]]] = {
        "languages": Counter(),
        "employment": Counter(),
        "employment_form": Counter(),
        "work_format": Counter(),
        "schedule": Counter(),
        "work_schedule_by_days": Counter(),
        "working_hours": Counter(),
        "working_time_intervals": Counter(),
        "working_time_modes": Counter(),
        "professional_roles": Counter(),
        "experience": Counter(),
        "education": Counter(),
        "civil_law_contracts": Counter(),
        "inclusiveness_types": Counter(),
        "driver_license_types": Counter(),
    }
    internship_count = night_shift_count = 0
    temporary_count = labor_contract_count = 0
    cover_letter_required_count = test_required_count = 0
    accessible_workplace_count = teen_candidate_count = 0

    def add_facet(counter: Counter[tuple[str, str]], value: object) -> None:
        values = value if isinstance(value, list) else [value]
        seen: set[tuple[str, str]] = set()
        for item in values:
            if not isinstance(item, dict):
                continue
            raw_id = str(item.get("id") or "").strip()
            name = str(item.get("name") or raw_id).strip()
            if not name:
                continue
            facet_key = (raw_id or name.casefold(), name[:300])
            if facet_key not in seen:
                counter[facet_key] += 1
                seen.add(facet_key)

    for _, experience_code, raw_value in rows:
        raw = raw_value if isinstance(raw_value, dict) else {}
        details_value = raw.get("details")
        details = details_value if isinstance(details_value, dict) else {}
        is_enriched = (
            details.get("schema_version") == "hh-details-v1"
            and details.get("status") == "ok"
        )
        enriched += int(is_enriched)

        employer = details.get("employer") or raw.get("employer")
        if isinstance(employer, dict):
            employer_id = str(employer.get("id") or "").strip()
            employer_name = str(employer.get("name") or "").strip()
            if employer_name:
                employer_key = employer_id or employer_name.casefold()
                employer_counts[employer_key] += 1
                employer_names.setdefault(employer_key, employer_name[:300])

        for target, facet_field in (
            ("languages", "languages"),
            ("employment", "employment"),
            ("employment_form", "employment_form"),
            ("work_format", "work_format"),
            ("schedule", "schedule"),
            ("work_schedule_by_days", "work_schedule_by_days"),
            ("working_hours", "working_hours"),
            ("working_time_intervals", "working_time_intervals"),
            ("working_time_modes", "working_time_modes"),
            ("professional_roles", "professional_roles"),
            ("education", "education"),
            ("civil_law_contracts", "civil_law_contracts"),
            ("inclusiveness_types", "inclusiveness_types"),
            ("driver_license_types", "driver_license_types"),
        ):
            value = (
                details.get(facet_field)
                if facet_field in details
                else raw.get(facet_field)
            )
            if target == "languages" and isinstance(value, list):
                languages_with_levels: list[dict[str, object]] = []
                for language in value:
                    if not isinstance(language, dict):
                        continue
                    normalized_language = dict(language)
                    level = language.get("level")
                    if isinstance(level, dict):
                        level_name = str(level.get("name") or level.get("id") or "").strip()
                        if level_name:
                            language_name = str(
                                language.get("name") or language.get("id") or ""
                            ).strip()
                            normalized_language["name"] = (
                                f"{language_name} · {level_name}"
                            )
                    languages_with_levels.append(normalized_language)
                value = languages_with_levels
            add_facet(facet_counts[target], value)

        experience_value = details.get("experience") or raw.get("experience")
        if not isinstance(experience_value, dict) and experience_code:
            experience_value = {"id": experience_code, "name": experience_code}
        add_facet(facet_counts["experience"], experience_value)
        internship_count += int(details.get("internship") is True)
        night_shift_count += int(details.get("night_shifts") is True)
        temporary_count += int(details.get("accept_temporary") is True)
        labor_contract_count += int(details.get("accept_labor_contract") is True)
        cover_letter_required_count += int(
            details.get("response_letter_required") is True
        )
        test_required_count += int(details.get("test_required") is True)
        accessible_workplace_count += int(details.get("accept_handicapped") is True)
        teen_candidate_count += int(details.get("accept_kids") is True)

    def facet_rows(
        counter: Counter[tuple[str, str]],
        *,
        denominator: int,
        limit: int = 8,
    ) -> list[HhFacetCount]:
        return [
            HhFacetCount(
                id=item_id,
                name=name,
                count=count,
                share=round(count / denominator, 4) if denominator else 0,
            )
            for (item_id, name), count in counter.most_common(limit)
        ]

    employer_vacancy_count = sum(employer_counts.values())
    leading_employers = employer_counts.most_common(5)
    employer_distribution = [
        HhFacetCount(
            id=item_id,
            name=employer_names[item_id],
            count=count,
            share=round(count / employer_vacancy_count, 4) if employer_vacancy_count else 0,
        )
        for item_id, count in leading_employers
    ]
    other_count = employer_vacancy_count - sum(count for _, count in leading_employers)
    if other_count:
        employer_distribution.append(
            HhFacetCount(
                id="other",
                name="Другие компании",
                count=other_count,
                share=round(other_count / employer_vacancy_count, 4),
            )
        )

    skill_rows = db.execute(
        select(
            VacancySkill.normalized_skill,
            func.min(VacancySkill.skill),
            func.count(VacancySkill.id),
        )
        .join(Vacancy, VacancySkill.vacancy_id == Vacancy.id)
        .where(
            Vacancy.source_id == source_id,
            Vacancy.profession_id == profession_id,
            Vacancy.published_at >= start_at,
            Vacancy.published_at < end_at,
        )
        .group_by(VacancySkill.normalized_skill)
        .order_by(desc(func.count(VacancySkill.id)))
        .limit(12)
    ).all()
    top_skills = [
        HhFacetCount(
            id=normalized,
            name=name,
            count=int(count),
            share=round(int(count) / enriched, 4) if enriched else 0,
        )
        for normalized, name, count in skill_rows
    ]

    return HhMarketEnrichmentSummary(
        enriched_vacancy_count=enriched,
        enrichment_coverage=round(enriched / total, 4) if total else 0,
        employer_vacancy_count=employer_vacancy_count,
        distinct_employer_count=len(employer_counts),
        employer_distribution=employer_distribution,
        top_skills=top_skills,
        languages=facet_rows(facet_counts["languages"], denominator=enriched),
        employment_types=facet_rows(facet_counts["employment"], denominator=total),
        employment_forms=facet_rows(
            facet_counts["employment_form"], denominator=enriched
        ),
        work_formats=facet_rows(facet_counts["work_format"], denominator=total),
        work_schedules=facet_rows(facet_counts["schedule"], denominator=total),
        work_schedule_by_days=facet_rows(
            facet_counts["work_schedule_by_days"], denominator=enriched
        ),
        working_hours=facet_rows(facet_counts["working_hours"], denominator=enriched),
        working_time_intervals=facet_rows(
            facet_counts["working_time_intervals"], denominator=enriched
        ),
        working_time_modes=facet_rows(
            facet_counts["working_time_modes"], denominator=enriched
        ),
        professional_roles=facet_rows(
            facet_counts["professional_roles"], denominator=total
        ),
        experience_levels=facet_rows(facet_counts["experience"], denominator=total),
        education_levels=facet_rows(facet_counts["education"], denominator=enriched),
        civil_law_contracts=facet_rows(
            facet_counts["civil_law_contracts"], denominator=enriched
        ),
        inclusiveness_types=facet_rows(
            facet_counts["inclusiveness_types"], denominator=enriched
        ),
        driver_license_types=facet_rows(
            facet_counts["driver_license_types"], denominator=enriched
        ),
        internship_count=internship_count,
        night_shift_count=night_shift_count,
        temporary_count=temporary_count,
        labor_contract_count=labor_contract_count,
        cover_letter_required_count=cover_letter_required_count,
        test_required_count=test_required_count,
        accessible_workplace_count=accessible_workplace_count,
        teen_candidate_count=teen_candidate_count,
    )


def _summary_rows(db: Session):
    scoring_version_id = _active_scoring_version_id(db)
    score_date = _latest_score_date(db, scoring_version_id)
    statement = (
        select(Profession, ProfessionCategory, ProfessionScoreDaily)
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .outerjoin(
            ProfessionScoreDaily,
            (ProfessionScoreDaily.profession_id == Profession.id)
            & (ProfessionScoreDaily.score_date == score_date)
            & (ProfessionScoreDaily.scoring_version_id == scoring_version_id),
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
    scoring_version_id = _active_scoring_version_id(db)
    score_date = _latest_score_date(db, scoring_version_id)
    row = db.execute(
        select(Profession, ProfessionCategory, ProfessionScoreDaily, ScoringVersion)
        .join(ProfessionCategory, Profession.category_id == ProfessionCategory.id)
        .outerjoin(
            ProfessionScoreDaily,
            (ProfessionScoreDaily.profession_id == Profession.id)
            & (ProfessionScoreDaily.score_date == score_date)
            & (ProfessionScoreDaily.scoring_version_id == scoring_version_id),
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
    hh_market_data = _hh_market_summary(
        db,
        profession.id,
        include_category_context=True,
    )
    salary_benchmark = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for(profession.slug, category.slug)
    )
    if summary.teaser_only:
        return ProfessionDetail(
            **summary.model_dump(),
            tech_stack=tech_stack,
            official_open_data=official_open_data,
            hh_market_data=hh_market_data,
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
            hh_market_data=hh_market_data,
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
        hh_market_data=hh_market_data,
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
        "schema": "hh-market-v1",
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
