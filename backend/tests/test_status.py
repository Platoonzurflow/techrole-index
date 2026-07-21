from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.api.professions as professions_api
import app.api.status as status_api
from app.api.professions import open_data_publications
from app.api.status import data_provenance, sources
from app.models import (
    Base,
    Profession,
    ProfessionCategory,
    ProfessionMetricDaily,
    Region,
    SeniorityLevel,
    Vacancy,
    VacancySource,
)


def test_sources_include_official_currency_provider() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        payload = sources(db)
    engine.dispose()

    currency = next(item for item in payload if item["code"] == "cbr_currency")
    assert currency["provider_type"] == "official_xml_api"
    assert currency["terms_url"] == "https://www.cbr.ru/development/sxml/"
    assert isinstance(currency["enabled"], bool)
    salary = next(item for item in payload if item["code"] == "habr_2026_h1")
    assert salary["provider_type"] == "public_salary_report"
    assert salary["salary_tax_status"] == "net"
    assert salary["period"] == "I полугодие 2026"


def test_data_provenance_marks_prepared_layer_without_live_market_claim() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        category = ProfessionCategory(slug="development", name_ru="Разработка", description="Тест")
        db.add(category)
        db.flush()
        profession = Profession(
            slug="python-developer",
            name_ru="Python-разработчик",
            name_en="Python Developer",
            description="Тестовая профессия для provenance endpoint",
            category_id=category.id,
        )
        region = Region(code="ru", name_ru="Россия")
        seniority = SeniorityLevel(code="junior", name_ru="Junior", sort_order=1)
        db.add_all([profession, region, seniority])
        db.flush()
        db.add(
            ProfessionMetricDaily(
                metric_date=date(2026, 7, 17),
                profession_id=profession.id,
                seniority_id=seniority.id,
                region_id=region.id,
                gross=True,
                vacancy_count=10,
                salary_count=10,
                salary_coverage=Decimal("1"),
                salary_median=Decimal("200000"),
                salary_average=Decimal("200000"),
                sample_size=10,
                confidence_level="low",
                remote_share=Decimal("0.5"),
            )
        )
        db.commit()
        payload = data_provenance(db)
    engine.dispose()

    prepared, official, benchmarks = payload["layers"]
    assert payload["schema_version"] == "1.3"
    assert prepared["status"] == "prepared_baseline"
    assert prepared["last_metric_date"] == date(2026, 7, 17)
    assert prepared["profession_count"] == 1
    assert prepared["current_market_claim"] is False
    assert official["status"] == "empty"
    assert official["salary_tax_status"] == "unknown"
    assert official["materialized_slice_count"] == 0
    assert official["materialized_publications"] == 0
    assert benchmarks["status"] == "public_reference"
    assert benchmarks["profession_count"] == 50
    assert benchmarks["latest_total_sample_size"] == 45226
    assert (
        sum(
            benchmarks[key]
            for key in ("direct_professions", "related_professions", "category_only_professions")
        )
        == 50
    )


def test_public_endpoints_share_complete_utc_calendar_window(monkeypatch) -> None:
    fixed_now = datetime(2026, 7, 21, 8, 26, 45, tzinfo=timezone.utc)

    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_now if tz is not None else fixed_now.replace(tzinfo=None)

    monkeypatch.setattr(status_api, "datetime", FixedDateTime)
    monkeypatch.setattr(professions_api, "datetime", FixedDateTime)

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        category = ProfessionCategory(slug="development", name_ru="Разработка", description="Тест")
        db.add(category)
        db.flush()
        profession = Profession(
            slug="python-developer",
            name_ru="Python-разработчик",
            name_en="Python Developer",
            description="Проверка общей UTC-границы публичных окон",
            category_id=category.id,
        )
        source = VacancySource(
            code="trudvsem_open",
            name="Работа России",
            provider_type="official_open_api",
            enabled=True,
        )
        region = Region(code="ru", name_ru="Россия")
        db.add_all([profession, source, region])
        db.flush()

        window_start = datetime(2026, 1, 23, tzinfo=timezone.utc)
        window_end = datetime(2026, 7, 22, tzinfo=timezone.utc)
        published = [
            window_start - timedelta(seconds=1),
            window_start,
            window_end - timedelta(seconds=1),
            window_end,
        ]
        db.add_all(
            [
                Vacancy(
                    source_id=source.id,
                    external_id=f"boundary-{index}",
                    title=f"Python developer boundary {index}",
                    region_id=region.id,
                    published_at=published_at,
                    first_seen_at=fixed_now,
                    last_seen_at=fixed_now,
                    profession_id=profession.id,
                )
                for index, published_at in enumerate(published)
            ]
        )
        db.commit()

        provenance = data_provenance(db)
        catalog = open_data_publications(db)
    engine.dispose()

    official = provenance["layers"][1]
    assert official["window_date_from"] == date(2026, 1, 23)
    assert official["window_date_to"] == date(2026, 7, 21)
    assert official["window_time_basis"] == "UTC_calendar_days"
    assert official["classified_publications"] == 2
    assert len(catalog) == 1
    assert catalog[0].total_publications == official["classified_publications"]
