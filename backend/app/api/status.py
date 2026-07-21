from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, or_, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.domain.time_windows import utc_calendar_window
from app.models import (
    IngestionRun,
    ObservedPublicationMetricDaily,
    ProfessionMetricDaily,
    Vacancy,
    VacancySource,
)

router = APIRouter(tags=["service"])


@router.get("/status")
def data_status(db: Session = Depends(get_db)):
    latest = db.scalar(select(IngestionRun).order_by(desc(IngestionRun.started_at)).limit(1))
    last_metric_date = db.scalar(
        select(ProfessionMetricDaily.metric_date)
        .order_by(desc(ProfessionMetricDaily.metric_date))
        .limit(1)
    )
    sources = db.scalars(select(VacancySource).order_by(VacancySource.code)).all()
    return {
        "service": "ok",
        "checked_at": datetime.now(timezone.utc),
        "last_metric_date": last_metric_date,
        "latest_ingestion": None
        if latest is None
        else {
            "status": latest.status,
            "started_at": latest.started_at,
            "finished_at": latest.finished_at,
            "records_seen": latest.records_seen,
            "error_summary": latest.error_summary,
        },
        "sources": [
            {"code": source.code, "name": source.name, "enabled": source.enabled}
            for source in sources
        ],
        "hh_runtime_enabled": settings.hh_enabled,
        "trudvsem_runtime_enabled": settings.trudvsem_enabled,
        "cbr_currency_enabled": settings.cbr_currency_enabled,
        "catalog_cache_enabled": settings.catalog_cache_enabled,
        "catalog_cache_ttl_seconds": settings.catalog_cache_ttl_seconds,
        "ai_classifier_enabled": settings.ai_classifier_enabled,
        "ollama_model": settings.ollama_model if settings.ai_classifier_enabled else None,
        "nightly_schedule": "0 0 * * * Europe/Moscow",
        "nightly_report_email_enabled": settings.nightly_report_email_enabled,
    }


@router.get("/sources")
def sources(db: Session = Depends(get_db)):
    vacancy_sources = [
        {
            "code": source.code,
            "name": source.name,
            "enabled": source.enabled,
            "provider_type": source.provider_type,
            "terms_url": source.terms_url,
        }
        for source in db.scalars(select(VacancySource).order_by(VacancySource.code)).all()
    ]
    return [
        *vacancy_sources,
        {
            "code": "cbr_currency",
            "name": "Банк России: официальные курсы валют",
            "enabled": settings.cbr_currency_enabled,
            "provider_type": "official_xml_api",
            "terms_url": "https://www.cbr.ru/development/sxml/",
        },
    ]


@router.get("/data-provenance")
def data_provenance(db: Session = Depends(get_db)):
    """Describe public data layers without implying that a prepared baseline is live."""
    now = datetime.now(timezone.utc)
    period_days = 180
    window = utc_calendar_window(now, days=period_days)
    last_metric_date = db.scalar(
        select(func.max(ProfessionMetricDaily.metric_date)).where(
            ProfessionMetricDaily.gross.is_(True)
        )
    )
    prepared_professions = 0
    if last_metric_date is not None:
        prepared_professions = int(
            db.scalar(
                select(func.count(func.distinct(ProfessionMetricDaily.profession_id))).where(
                    ProfessionMetricDaily.metric_date == last_metric_date,
                    ProfessionMetricDaily.gross.is_(True),
                )
            )
            or 0
        )

    source = db.scalar(
        select(VacancySource).where(VacancySource.code == "trudvsem_open")
    )
    official_filters = (
        Vacancy.source_id == source.id if source is not None else Vacancy.source_id == -1,
        Vacancy.published_at >= window.start_at,
        Vacancy.published_at < window.end_at_exclusive,
    )
    official_records = int(
        db.scalar(select(func.count(Vacancy.id)).where(*official_filters)) or 0
    )
    classified_records = int(
        db.scalar(
            select(func.count(Vacancy.id)).where(
                *official_filters, Vacancy.profession_id.is_not(None)
            )
        )
        or 0
    )
    salary_disclosed_records = int(
        db.scalar(
            select(func.count(Vacancy.id)).where(
                *official_filters,
                Vacancy.profession_id.is_not(None),
                or_(Vacancy.salary_from.is_not(None), Vacancy.salary_to.is_not(None)),
            )
        )
        or 0
    )
    observed_from, observed_to, last_ingested_at = db.execute(
        select(
            func.min(Vacancy.published_at),
            func.max(Vacancy.published_at),
            func.max(Vacancy.last_seen_at),
        ).where(*official_filters, Vacancy.profession_id.is_not(None))
    ).one()
    (
        materialized_from,
        materialized_to,
        materialized_slices,
        materialized_publications,
        materialized_at,
        transform_version,
    ) = db.execute(
        select(
            func.min(ObservedPublicationMetricDaily.metric_date),
            func.max(ObservedPublicationMetricDaily.metric_date),
            func.count(ObservedPublicationMetricDaily.id),
            func.coalesce(func.sum(ObservedPublicationMetricDaily.publication_count), 0),
            func.max(ObservedPublicationMetricDaily.updated_at),
            func.max(ObservedPublicationMetricDaily.transform_version),
        ).where(
            ObservedPublicationMetricDaily.source_id
            == (source.id if source is not None else -1)
        )
    ).one()

    return {
        "schema_version": "1.2",
        "generated_at": now,
        "layers": [
            {
                "id": "prepared_analytics",
                "label": "Подготовленная аналитическая витрина",
                "status": "prepared_baseline" if last_metric_date else "unavailable",
                "last_metric_date": last_metric_date,
                "profession_count": prepared_professions,
                "salary_currency": "RUB",
                "salary_tax_status": "gross",
                "current_market_claim": False,
                "interpretation": (
                    "Детерминированная витрина для проверки продукта и методики. "
                    "Дата метрики не означает подтверждённую свежесть рынка."
                ),
            },
            {
                "id": "official_publications",
                "label": "Подтверждённый официальный слой публикаций",
                "status": "observed_historical" if classified_records else "empty",
                "source_code": source.code if source is not None else "trudvsem_open",
                "source_name": source.name if source is not None else "Работа России",
                "source_url": source.terms_url if source is not None else None,
                "period_days": period_days,
                "window_date_from": window.date_from,
                "window_date_to": window.date_to,
                "window_time_basis": "UTC_calendar_days",
                "window_start_at": window.start_at,
                "window_end_at_exclusive": window.end_at_exclusive,
                "observed_date_from": observed_from,
                "observed_date_to": observed_to,
                "source_records": official_records,
                "classified_publications": classified_records,
                "salary_disclosed_records": salary_disclosed_records,
                "last_ingested_at": last_ingested_at,
                "materialized_date_from": materialized_from,
                "materialized_date_to": materialized_to,
                "materialized_slice_count": int(materialized_slices or 0),
                "materialized_publications": int(materialized_publications or 0),
                "materialized_at": materialized_at,
                "materialized_transform_version": transform_version,
                "salary_currency": "RUB",
                "salary_tax_status": "unknown",
                "current_market_claim": False,
                "interpretation": (
                    "Исторические публикации по дате создания записи, а не число "
                    "одновременно активных вакансий. Gross/net источником не определён."
                ),
            },
        ],
    }
@router.get("/health/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready"}
