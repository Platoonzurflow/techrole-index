from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Base,
    IngestionRun,
    Profession,
    ProfessionAlias,
    ProfessionCategory,
    Region,
    SeniorityLevel,
    Vacancy,
    VacancySkill,
    VacancySource,
)
from app.providers.vacancies import VacancyRecord
from app.services.open_data_ingestion import ingest_trudvsem_open_data


class FakeOpenProvider:
    code = "trudvsem_open"

    def fetch(
        self, query: str, region_code: str, *, limit: int = 100, offset: int = 0
    ) -> Iterator[VacancyRecord]:
        assert query == "Python-разработчик"
        assert region_code == "ru"
        assert limit == 1
        if offset:
            return
        yield VacancyRecord(
            external_id="open-1",
            title="Junior Python разработчик",
            region_code="7700000000000",
            salary_from=Decimal("120000"),
            salary_to=Decimal("160000"),
            currency="RUB",
            gross=None,
            published_at=datetime(2026, 7, 18, tzinfo=timezone.utc),
            experience="no_experience",
            is_remote=True,
            skills=(
                "Python",
                "SQL",
                "A" * 120 + " first suffix",
                "A" * 120 + " second suffix",
            ),
            raw={"provider": "trudvsem_open", "id": "open-1"},
        )


def test_open_data_ingestion_keeps_unknown_gross_separate() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    original = {
        "trudvsem_enabled": settings.trudvsem_enabled,
        "trudvsem_query_limit": settings.trudvsem_query_limit,
        "trudvsem_max_professions": settings.trudvsem_max_professions,
        "trudvsem_history_days": settings.trudvsem_history_days,
        "trudvsem_max_pages_per_query": settings.trudvsem_max_pages_per_query,
        "trudvsem_use_alias_queries": settings.trudvsem_use_alias_queries,
        "trudvsem_request_delay_seconds": settings.trudvsem_request_delay_seconds,
        "ai_classifier_enabled": settings.ai_classifier_enabled,
    }
    settings.trudvsem_enabled = True
    settings.trudvsem_query_limit = 1
    settings.trudvsem_max_professions = 1
    settings.trudvsem_history_days = 180
    settings.trudvsem_max_pages_per_query = 3
    settings.trudvsem_use_alias_queries = False
    settings.trudvsem_request_delay_seconds = 0
    settings.ai_classifier_enabled = False
    try:
        with Session(engine) as db:
            category = ProfessionCategory(slug="development", name_ru="Разработка")
            db.add(category)
            db.flush()
            profession = Profession(
                slug="python-developer",
                name_ru="Python-разработчик",
                name_en="Python Developer",
                description="Разработка приложений и сервисов на Python.",
                category_id=category.id,
                is_active=True,
            )
            regions = (
                Region(code="ru", name_ru="Россия"),
                Region(code="msk", name_ru="Москва"),
                Region(code="spb", name_ru="Санкт-Петербург"),
                Region(code="other", name_ru="Другие регионы"),
            )
            junior = SeniorityLevel(code="junior", name_ru="Junior", sort_order=1)
            db.add_all((profession, *regions, junior))
            db.flush()
            db.add(ProfessionAlias(profession_id=profession.id, alias="python"))
            source = VacancySource(
                code="trudvsem_open",
                name="Работа России",
                provider_type="official_open_api",
                enabled=True,
            )
            db.add(source)
            db.flush()
            db.add(
                IngestionRun(
                    source_id=source.id,
                    started_at=datetime.now(timezone.utc) - timedelta(hours=2),
                    status="running",
                    records_seen=0,
                    records_changed=0,
                    metadata_json={"provider": "trudvsem_open"},
                )
            )
            db.commit()

            summary = ingest_trudvsem_open_data(
                db,
                provider=FakeOpenProvider(),
                sleep=lambda _: None,
            )

            assert summary.status == "success"
            assert summary.records_seen == 1
            assert summary.records_changed == 1
            vacancy = db.scalar(select(Vacancy))
            assert vacancy is not None
            assert vacancy.profession_id == profession.id
            assert vacancy.seniority_id == junior.id
            assert vacancy.salary_gross is None
            assert vacancy.classifier_version == "rules-v2"
            assert vacancy.raw_payload == {"provider": "trudvsem_open", "id": "open-1"}
            assert db.scalar(select(func.count()).select_from(VacancySkill)) == 3
            source = db.scalar(
                select(VacancySource).where(VacancySource.code == "trudvsem_open")
            )
            assert source is not None
            assert source.enabled is True
            stale_run = db.scalar(select(IngestionRun).order_by(IngestionRun.id))
            assert stale_run is not None
            assert stale_run.status == "failed"
            assert stale_run.error_summary == "interrupted_before_completion"
            run = db.scalar(select(IngestionRun).order_by(IngestionRun.id.desc()))
            assert run is not None
            assert run.metadata_json["metrics_recalculated"] is False
    finally:
        for key, value in original.items():
            setattr(settings, key, value)
        engine.dispose()
