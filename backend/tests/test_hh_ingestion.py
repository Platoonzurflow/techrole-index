from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.professions import _hh_market_summary
from app.config import settings
from app.models import (
    Base,
    IngestionRun,
    Profession,
    ProfessionAlias,
    ProfessionCategory,
    Region,
    SalaryObservation,
    SeniorityLevel,
    Vacancy,
    VacancySource,
)
from app.providers.vacancies import VacancyRecord
from app.services.open_data_ingestion import ingest_hh_data


class FakeHhProvider:
    code = "hh_api"

    def fetch(
        self, query: str, region_code: str, *, limit: int = 100, offset: int = 0
    ) -> Iterator[VacancyRecord]:
        assert query == "Python-разработчик"
        assert region_code == "ru"
        assert limit == 1
        if offset:
            return
        yield VacancyRecord(
            external_id="hh-1",
            title="Middle Python разработчик",
            region_code="1",
            salary_from=Decimal("180000"),
            salary_to=Decimal("240000"),
            currency="RUB",
            gross=True,
            published_at=datetime.now(timezone.utc) - timedelta(days=1),
            experience="between1And3",
            is_remote=True,
            skills=(),
            raw={"provider": "hh_api", "id": "hh-1"},
        )


def test_hh_ingestion_is_source_isolated_and_preserves_gross() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    original = {
        "hh_enabled": settings.hh_enabled,
        "hh_commercial_use_confirmed": settings.hh_commercial_use_confirmed,
        "hh_contact_email": settings.hh_contact_email,
        "hh_app_name": settings.hh_app_name,
        "hh_access_token": settings.hh_access_token,
        "hh_query_limit": settings.hh_query_limit,
        "hh_max_professions": settings.hh_max_professions,
        "hh_history_days": settings.hh_history_days,
        "hh_max_pages_per_query": settings.hh_max_pages_per_query,
        "hh_use_alias_queries": settings.hh_use_alias_queries,
        "hh_request_delay_seconds": settings.hh_request_delay_seconds,
        "ai_classifier_enabled": settings.ai_classifier_enabled,
    }
    settings.hh_enabled = True
    settings.hh_commercial_use_confirmed = True
    settings.hh_contact_email = "owner@example.com"
    settings.hh_app_name = "TechRoleIndex"
    settings.hh_access_token = "test-token"
    settings.hh_query_limit = 1
    settings.hh_max_professions = 1
    settings.hh_history_days = 30
    settings.hh_max_pages_per_query = 3
    settings.hh_use_alias_queries = False
    settings.hh_request_delay_seconds = 0
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
            middle = SeniorityLevel(code="middle", name_ru="Middle", sort_order=2)
            db.add_all((profession, *regions, middle))
            db.flush()
            db.add(ProfessionAlias(profession_id=profession.id, alias="python"))
            db.commit()

            summary = ingest_hh_data(db, provider=FakeHhProvider(), sleep=lambda _: None)

            assert summary.status == "success"
            assert summary.source == "hh_api"
            assert summary.records_seen == 1
            vacancy = db.scalar(select(Vacancy))
            assert vacancy is not None
            assert vacancy.profession_id == profession.id
            assert vacancy.seniority_id == middle.id
            assert vacancy.region_id == regions[1].id
            assert vacancy.salary_gross is True
            source = db.scalar(select(VacancySource))
            assert source is not None
            assert source.code == "hh_api"
            observation = db.scalar(select(SalaryObservation))
            assert observation is not None
            assert observation.gross is True
            market = _hh_market_summary(db, profession.id)
            assert market is not None
            assert market.total_publications == 1
            assert market.salary_disclosed_count == 1
            assert market.salary_gross_count == 1
            assert market.salary_net_count == 0
            assert market.salary_tax_unknown_count == 0
            assert market.salary_gross_status == "reported_per_vacancy"

            db.add(
                IngestionRun(
                    source_id=source.id,
                    started_at=datetime.now(timezone.utc),
                    status="running",
                    records_seen=0,
                    records_changed=0,
                )
            )
            db.commit()
            with pytest.raises(RuntimeError, match="already running"):
                ingest_hh_data(db, provider=FakeHhProvider(), sleep=lambda _: None)
    finally:
        for key, value in original.items():
            setattr(settings, key, value)
        engine.dispose()
