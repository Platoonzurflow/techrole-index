from __future__ import annotations

import json
from datetime import datetime, timezone

from dagster import (
    DefaultScheduleStatus,
    Definitions,
    Failure,
    ScheduleDefinition,
    job,
    op,
)

from app.config import settings
from app.database import SessionLocal
from app.models import IngestionRun
from app.providers.email import (
    EmailDeliveryNotConfigured,
    PipelineReportEmail,
    get_nightly_email_provider,
)
from app.services.currency_rates import snapshot_configured_currency_rates
from app.services.open_data_ingestion import ingest_trudvsem_open_data
from app.services.publication_metrics import refresh_observed_publication_metrics
from app.services.salary_source_audit import (
    audit_habr_calculator_public_medians,
    record_salary_source_audit,
)


def _send_report(*, status: str, started_at: datetime, summary: dict) -> str:
    try:
        get_nightly_email_provider().send_pipeline_report(
            PipelineReportEmail(
                status=status,
                started_at=started_at.isoformat(),
                finished_at=datetime.now(timezone.utc).isoformat(),
                summary=json.dumps(summary, ensure_ascii=False, indent=2, default=str),
            )
        )
        return "sent"
    except EmailDeliveryNotConfigured:
        return "disabled"
    except Exception as exc:
        return f"failed:{type(exc).__name__}"


@op(name="snapshot_official_currency_rates")
def snapshot_official_currency_rates(context) -> dict:
    try:
        with SessionLocal() as db:
            result = snapshot_configured_currency_rates(db)
    except Exception as exc:
        context.log.exception("Official currency snapshot failed")
        raise Failure(
            description="Official currency snapshot failed",
            metadata={"status": "failed", "error": type(exc).__name__},
        ) from exc
    context.log.info(json.dumps(result, ensure_ascii=False, default=str))
    return result


@op(name="collect_and_classify_open_vacancies")
def collect_and_classify_open_vacancies(context) -> dict:
    started_at = datetime.now(timezone.utc)
    if not settings.trudvsem_enabled:
        result = {"status": "skipped", "reason": "TRUDVSEM_ENABLED=false"}
        result["email_report"] = _send_report(
            status="skipped", started_at=started_at, summary=result
        )
        context.log.warning("Open-data ingestion is disabled")
        return result

    try:
        with SessionLocal() as db:
            result = ingest_trudvsem_open_data(db).to_dict()
    except Exception as exc:
        result = {"status": "failed", "error": type(exc).__name__}
        result["email_report"] = _send_report(
            status="failed", started_at=started_at, summary=result
        )
        context.log.exception("Nightly open-data ingestion failed")
        raise Failure(
            description="Nightly open-data ingestion failed",
            metadata=result,
        ) from exc

    result["email_report"] = _send_report(
        status=result["status"], started_at=started_at, summary=result
    )
    context.log.info(json.dumps(result, ensure_ascii=False, default=str))
    return result


@op(name="verify_public_salary_benchmarks")
def verify_public_salary_benchmarks(context) -> dict:
    if not settings.salary_source_audit_enabled:
        result: dict[str, object] = {
            "status": "skipped",
            "reason": "SALARY_SOURCE_AUDIT_ENABLED=false",
        }
        context.log.info(json.dumps(result, ensure_ascii=False))
        return result

    checked_at = datetime.now(timezone.utc)
    try:
        result = audit_habr_calculator_public_medians(
            timeout_seconds=settings.salary_source_audit_timeout_seconds
        )
    except Exception as exc:
        result = {
            "status": "failed",
            "checked": 0,
            "verified": 0,
            "changed": 0,
            "unavailable": 0,
            "error": type(exc).__name__,
        }
        try:
            with SessionLocal.begin() as db:
                record_salary_source_audit(db, result, occurred_at=checked_at)
        except Exception:
            context.log.exception("Could not persist failed salary source audit")
        context.log.exception("Public salary benchmark audit failed")
        raise Failure(
            description="Public salary benchmark audit failed",
            metadata={"status": "failed", "error": type(exc).__name__},
        ) from exc

    try:
        with SessionLocal.begin() as db:
            record_salary_source_audit(db, result, occurred_at=checked_at)
    except Exception as exc:
        context.log.exception("Could not persist salary source audit")
        raise Failure(
            description="Could not persist public salary benchmark audit",
            metadata={"status": "failed", "error": type(exc).__name__},
        ) from exc
    if result["status"] == "changed":
        context.log.error(json.dumps(result, ensure_ascii=False, default=str))
        raise Failure(
            description="Public salary benchmark metadata changed",
            metadata={
                "status": str(result["status"]),
                "checked": int(str(result["checked"])),
                "verified": int(str(result["verified"])),
                "changed": int(str(result["changed"])),
                "unavailable": int(str(result["unavailable"])),
            },
        )
    if result["status"] == "partial":
        context.log.warning(json.dumps(result, ensure_ascii=False, default=str))
    else:
        context.log.info(json.dumps(result, ensure_ascii=False, default=str))
    return result


@op(name="materialize_observed_publication_metrics")
def materialize_observed_publication_metrics(context, ingestion_result: dict) -> dict:
    if ingestion_result.get("status") != "success":
        result = {
            "status": "skipped",
            "reason": "ingestion_not_complete",
            "ingestion_status": ingestion_result.get("status"),
        }
        context.log.warning(json.dumps(result, ensure_ascii=False))
        return result
    run_id = ingestion_result.get("run_id")
    if not isinstance(run_id, int):
        raise Failure(
            description="Publication metric transform has no ingestion run id",
            metadata={"status": "failed", "reason": "missing_run_id"},
        )
    try:
        with SessionLocal() as db:
            run = db.get(IngestionRun, run_id)
            if run is None:
                raise RuntimeError("Ingestion run not found")
            metadata = run.metadata_json or {}
            oldest = metadata.get("oldest_published_at")
            newest = metadata.get("newest_published_at")
            date_from = datetime.fromisoformat(oldest).date() if oldest else None
            date_to = datetime.fromisoformat(newest).date() if newest else None
            transformed = refresh_observed_publication_metrics(
                db,
                source_code=ingestion_result.get("source", "trudvsem_open"),
                date_from=date_from,
                date_to=date_to,
            )
            result = transformed.to_dict()
            result["date_from"] = (
                transformed.date_from.isoformat() if transformed.date_from else None
            )
            result["date_to"] = transformed.date_to.isoformat() if transformed.date_to else None
            run.metadata_json = {
                **metadata,
                "publication_metrics_materialized": transformed.status == "success",
                "publication_metric_transform": result,
            }
            db.commit()
    except Exception as exc:
        context.log.exception("Observed publication metric transform failed")
        raise Failure(
            description="Observed publication metric transform failed",
            metadata={"status": "failed", "error": type(exc).__name__},
        ) from exc
    context.log.info(json.dumps(result, ensure_ascii=False, default=str))
    return result


@job(name="techrole_nightly_market_pipeline")
def nightly_market_pipeline():
    snapshot_official_currency_rates()
    verify_public_salary_benchmarks()
    ingestion_result = collect_and_classify_open_vacancies()
    materialize_observed_publication_metrics(ingestion_result)


nightly_schedule = ScheduleDefinition(
    name="techrole_midnight_moscow",
    job=nightly_market_pipeline,
    cron_schedule="0 0 * * *",
    execution_timezone="Europe/Moscow",
    default_status=DefaultScheduleStatus.RUNNING,
)


defs = Definitions(
    jobs=[nightly_market_pipeline],
    schedules=[nightly_schedule],
)
