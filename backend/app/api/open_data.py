from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import (
    ObservedPublicationMetricDaily,
    Profession,
    Region,
    VacancySource,
)
from app.schemas import (
    ObservedPublicationMetricOut,
    ObservedPublicationMetricsExportOut,
)

router = APIRouter(prefix="/open-data", tags=["open-data"])


@router.get(
    "/publication-metrics-daily",
    response_model=ObservedPublicationMetricsExportOut,
)
def publication_metrics_daily(db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            ObservedPublicationMetricDaily,
            VacancySource.code,
            VacancySource.name,
            Profession.slug,
            Profession.name_ru,
            Region.code,
            Region.name_ru,
        )
        .join(
            VacancySource,
            VacancySource.id == ObservedPublicationMetricDaily.source_id,
        )
        .join(Profession, Profession.id == ObservedPublicationMetricDaily.profession_id)
        .join(Region, Region.id == ObservedPublicationMetricDaily.region_id)
        .where(VacancySource.code == "trudvsem_open")
        .order_by(
            ObservedPublicationMetricDaily.metric_date,
            Profession.slug,
            ObservedPublicationMetricDaily.seniority_code,
            Region.code,
            ObservedPublicationMetricDaily.salary_tax_status,
        )
    ).all()
    sample_gate = get_settings().min_salary_sample
    records: list[ObservedPublicationMetricOut] = []
    for (
        metric,
        source_code,
        source_name,
        profession_slug,
        profession_name_ru,
        region_code,
        region_name_ru,
    ) in rows:
        publish_salary = metric.midpoint_sample_size >= sample_gate
        records.append(
            ObservedPublicationMetricOut(
                metric_date=metric.metric_date,
                source_code=source_code,
                source_name=source_name,
                profession_slug=profession_slug,
                profession_name_ru=profession_name_ru,
                seniority=metric.seniority_code,
                region_code=region_code,
                region_name_ru=region_name_ru,
                salary_tax_status=metric.salary_tax_status,
                normalized_currency=metric.normalized_currency,
                publication_count=metric.publication_count,
                salary_disclosed_count=metric.salary_disclosed_count,
                salary_coverage=float(metric.salary_coverage),
                midpoint_sample_size=metric.midpoint_sample_size,
                salary_median=(
                    float(metric.salary_median)
                    if publish_salary and metric.salary_median is not None
                    else None
                ),
                salary_average=(
                    float(metric.salary_average)
                    if publish_salary and metric.salary_average is not None
                    else None
                ),
                salary_p25=(
                    float(metric.salary_p25)
                    if publish_salary and metric.salary_p25 is not None
                    else None
                ),
                salary_p75=(
                    float(metric.salary_p75)
                    if publish_salary and metric.salary_p75 is not None
                    else None
                ),
                lower_bound_median=(
                    float(metric.lower_bound_median)
                    if publish_salary and metric.lower_bound_median is not None
                    else None
                ),
                upper_bound_median=(
                    float(metric.upper_bound_median)
                    if publish_salary and metric.upper_bound_median is not None
                    else None
                ),
                confidence_level=(metric.confidence_level if publish_salary else "insufficient"),
                remote_count=metric.remote_count,
                remote_share=float(metric.remote_share),
                last_ingested_at=metric.last_ingested_at,
                materialized_at=metric.updated_at,
                transform_version=metric.transform_version,
            )
        )
    return ObservedPublicationMetricsExportOut(
        salary_minimum_sample=sample_gate,
        records=records,
    )
