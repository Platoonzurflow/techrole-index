import pytest
from dagster import Failure, build_op_context
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.dagster_defs as dagster_module
from app.dagster_defs import defs, nightly_schedule
from app.models import AuditLog, Base
from app.services.salary_source_audit import SALARY_SOURCE_AUDIT_ACTION


def test_dagster_midnight_moscow_schedule_is_enabled() -> None:
    assert nightly_schedule.cron_schedule == "0 0 * * *"
    assert nightly_schedule.execution_timezone == "Europe/Moscow"
    assert nightly_schedule.name == "techrole_midnight_moscow"
    assert defs.get_job_def("techrole_nightly_market_pipeline").name == (
        "techrole_nightly_market_pipeline"
    )
    assert {
        node.name
        for node in defs.get_job_def("techrole_nightly_market_pipeline").graph.node_defs
    } == {
        "snapshot_official_currency_rates",
        "verify_public_salary_benchmarks",
        "collect_and_classify_open_vacancies",
        "materialize_observed_publication_metrics",
    }


def test_salary_source_op_persists_audit_result(monkeypatch) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    result = {
        "status": "verified",
        "checked": 8,
        "verified": 8,
        "changed": 0,
        "unavailable": 0,
        "entries": [],
    }
    monkeypatch.setattr(dagster_module, "SessionLocal", session_factory)
    monkeypatch.setattr(dagster_module.settings, "salary_source_audit_enabled", True)
    monkeypatch.setattr(
        dagster_module,
        "audit_habr_calculator_public_medians",
        lambda **_kwargs: result,
    )

    with build_op_context() as context:
        assert dagster_module.verify_public_salary_benchmarks(context) == result

    with Session(engine) as db:
        stored = db.scalar(
            select(AuditLog).where(AuditLog.action == SALARY_SOURCE_AUDIT_ACTION)
        )
        assert stored is not None
        assert stored.details == result
    engine.dispose()


def test_salary_source_op_persists_drift_before_failing(monkeypatch) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    result = {
        "status": "changed",
        "checked": 8,
        "verified": 7,
        "changed": 1,
        "unavailable": 0,
        "entries": [],
    }
    monkeypatch.setattr(dagster_module, "SessionLocal", session_factory)
    monkeypatch.setattr(dagster_module.settings, "salary_source_audit_enabled", True)
    monkeypatch.setattr(
        dagster_module,
        "audit_habr_calculator_public_medians",
        lambda **_kwargs: result,
    )

    with build_op_context() as context, pytest.raises(Failure):
        dagster_module.verify_public_salary_benchmarks(context)

    with Session(engine) as db:
        stored = db.scalar(
            select(AuditLog).where(AuditLog.action == SALARY_SOURCE_AUDIT_ACTION)
        )
        assert stored is not None
        assert stored.details["status"] == "changed"
    engine.dispose()
