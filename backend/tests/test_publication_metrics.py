from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from importlib.resources import files

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.open_data import publication_metrics_daily
from app.models import (
    Base,
    ObservedPublicationMetricDaily,
    Profession,
    ProfessionCategory,
    ProfessionMetricDaily,
    Region,
    SalaryObservation,
    SeniorityLevel,
    Vacancy,
    VacancySource,
)
from app.services.publication_metrics import refresh_observed_publication_metrics


def test_observed_publication_transform_is_idempotent_and_isolated() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    metric_date = date(2026, 7, 20)
    observed_at = datetime(2026, 7, 21, 0, 0, tzinfo=timezone.utc)
    with Session(engine) as db:
        category = ProfessionCategory(slug="development", name_ru="Разработка")
        db.add(category)
        db.flush()
        profession = Profession(
            slug="python-developer",
            name_ru="Python-разработчик",
            name_en="Python Developer",
            description="Тестовая профессия",
            category_id=category.id,
        )
        source = VacancySource(
            code="trudvsem_open",
            name="Работа России",
            provider_type="official_open_api",
            enabled=True,
        )
        region = Region(code="msk", name_ru="Москва")
        junior = SeniorityLevel(code="junior", name_ru="Junior", sort_order=1)
        db.add_all([profession, source, region, junior])
        db.flush()

        vacancies = [
            Vacancy(
                source_id=source.id,
                external_id=f"publication-{index}",
                title=f"Python developer {index}",
                region_id=region.id,
                currency="RUB",
                salary_gross=None,
                salary_from=lower,
                salary_to=upper,
                published_at=datetime(2026, 7, 20, 12 + index, tzinfo=timezone.utc),
                first_seen_at=observed_at,
                last_seen_at=observed_at,
                is_remote=index == 1,
                profession_id=profession.id,
                seniority_id=junior.id if index < 3 else None,
            )
            for index, (lower, upper) in enumerate(
                (
                    (Decimal("100000"), Decimal("200000")),
                    (Decimal("150000"), Decimal("250000")),
                    (None, None),
                ),
                start=1,
            )
        ]
        db.add_all(vacancies)
        db.flush()
        db.add_all(
            [
                SalaryObservation(
                    vacancy_id=vacancies[0].id,
                    observed_date=metric_date - timedelta(days=1),
                    original_currency="RUB",
                    normalized_currency="RUB",
                    rate=Decimal("1"),
                    gross=None,
                    salary_from=Decimal("90000"),
                    salary_to=Decimal("190000"),
                    midpoint=Decimal("140000"),
                    rate_provider="identity-rub-v1",
                ),
                SalaryObservation(
                    vacancy_id=vacancies[0].id,
                    observed_date=metric_date,
                    original_currency="RUB",
                    normalized_currency="RUB",
                    rate=Decimal("1"),
                    gross=None,
                    salary_from=Decimal("100000"),
                    salary_to=Decimal("200000"),
                    midpoint=Decimal("150000"),
                    rate_provider="identity-rub-v1",
                ),
            ]
        )
        db.commit()

        first = refresh_observed_publication_metrics(
            db,
            date_from=metric_date,
            date_to=metric_date,
            min_salary_sample=2,
        )
        assert first.status == "success"
        assert first.slice_count == 2
        assert first.publication_count == 3
        assert first.salary_disclosed_count == 2
        assert first.midpoint_sample_size == 2
        assert db.scalar(select(func.count()).select_from(ProfessionMetricDaily)) == 0

        junior_slice = db.scalar(
            select(ObservedPublicationMetricDaily).where(
                ObservedPublicationMetricDaily.seniority_code == "junior"
            )
        )
        assert junior_slice is not None
        assert junior_slice.salary_tax_status == "unknown"
        assert junior_slice.publication_count == 2
        assert junior_slice.salary_median == Decimal("175000.00")
        assert junior_slice.remote_share == Decimal("0.50000")

        vacancies[2].seniority_id = junior.id
        db.commit()
        second = refresh_observed_publication_metrics(
            db,
            date_from=metric_date,
            date_to=metric_date,
            min_salary_sample=2,
        )
        assert second.slice_count == 1
        assert second.deleted_stale_slices == 1
        merged = db.scalar(select(ObservedPublicationMetricDaily))
        assert merged is not None
        persisted_id = merged.id
        assert merged.publication_count == 3
        assert merged.remote_share == Decimal("0.33333")

        third = refresh_observed_publication_metrics(
            db,
            date_from=metric_date,
            date_to=metric_date,
            min_salary_sample=2,
        )
        assert third.slice_count == 1
        assert third.deleted_stale_slices == 0
        assert db.scalar(select(ObservedPublicationMetricDaily.id)) == persisted_id
        exported = publication_metrics_daily(db)
        assert exported.salary_minimum_sample == 20
        assert len(exported.records) == 1
        assert exported.records[0].profession_slug == "python-developer"
        assert exported.records[0].publication_count == 3
        assert exported.records[0].salary_tax_status == "unknown"
        assert exported.records[0].midpoint_sample_size == 2
        assert exported.records[0].salary_median is None
        assert exported.records[0].confidence_level == "insufficient"
        assert exported.records[0].current_market_claim is False
    engine.dispose()


def test_postgres_transform_uses_publication_semantics_and_atomic_upsert() -> None:
    sql = files("app.sql").joinpath("observed_publication_metrics_daily.sql").read_text(
        encoding="utf-8"
    )
    assert "published_at AT TIME ZONE 'UTC'" in sql
    assert "ON CONFLICT ON CONSTRAINT uq_observed_publication_metric_slice" in sql
    assert "salary_tax_status" in sql
    assert "midpoint_sample_size >= :min_salary_sample" in sql
    assert "profession_metrics_daily" not in sql
