from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.professions import _hh_metric_salary_history
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
from app.services.hh_profession_metrics import refresh_hh_profession_metrics


def test_refresh_hh_profession_metrics_uses_exact_profession_windows() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    now = datetime(2026, 8, 5, 12, tzinfo=timezone.utc)
    with Session(engine) as db:
        category = ProfessionCategory(slug="quality", name_ru="Тестирование")
        national = Region(code="ru", name_ru="Россия")
        moscow = Region(code="msk", name_ru="Москва")
        junior = SeniorityLevel(code="junior", name_ru="Junior", sort_order=1)
        middle = SeniorityLevel(code="middle", name_ru="Middle", sort_order=2)
        senior = SeniorityLevel(code="senior", name_ru="Senior", sort_order=3)
        source = VacancySource(
            code="hh_api", name="HH API", provider_type="HhApiProvider", enabled=True
        )
        db.add_all([category, national, moscow, junior, middle, senior, source])
        db.flush()
        profession = Profession(
            slug="qa-engineer",
            name_ru="QA-инженер",
            name_en="QA Engineer",
            description="",
            category_id=category.id,
        )
        db.add(profession)
        db.flush()
        retained_date = now.date() - timedelta(days=5)
        db.add(
            ProfessionMetricDaily(
                metric_date=retained_date,
                profession_id=profession.id,
                seniority_id=middle.id,
                region_id=national.id,
                gross=True,
                vacancy_count=5,
                salary_count=5,
                salary_coverage=Decimal("1"),
                salary_median=Decimal("140000"),
                salary_average=Decimal("140000"),
                salary_p25=Decimal("140000"),
                salary_p75=Decimal("140000"),
                lower_bound_median=Decimal("120000"),
                upper_bound_median=Decimal("160000"),
                sample_size=5,
                confidence_level="low",
                remote_share=Decimal("0"),
            )
        )
        for index in range(15):
            experience = (
                "noExperience"
                if index < 2
                else "between1And3"
                if index < 9
                else "between3And6"
            )
            db.add(
                Vacancy(
                    source_id=source.id,
                    external_id=f"qa-{index}",
                    title="QA Engineer",
                    region_id=moscow.id,
                    currency="RUB",
                    salary_gross=True,
                    salary_from=Decimal("100000"),
                    salary_to=Decimal("200000"),
                    published_at=now - timedelta(days=index % 3),
                    first_seen_at=now,
                    last_seen_at=now,
                    is_remote=index == 0,
                    experience_code=experience,
                    profession_id=profession.id,
                    seniority_id=middle.id,
                )
            )
        db.commit()

        result = refresh_hh_profession_metrics(
            db, rolling_window_days=30, history_days=10
        )
        latest = db.scalar(
            select(ProfessionMetricDaily).where(
                ProfessionMetricDaily.metric_date == now.date(),
                ProfessionMetricDaily.profession_id == profession.id,
                ProfessionMetricDaily.region_id == national.id,
                ProfessionMetricDaily.seniority_id == middle.id,
            )
        )

        assert result.profession_count == 1
        assert result.vacancy_count == 15
        assert result.metric_rows == 18
        assert latest is not None
        assert latest.vacancy_count == 8
        assert latest.salary_count == 8
        assert latest.salary_median == Decimal("150000")
        assert latest.remote_share == Decimal("0.06667")
        retained = db.scalar(
            select(ProfessionMetricDaily).where(
                ProfessionMetricDaily.metric_date == retained_date,
                ProfessionMetricDaily.profession_id == profession.id,
                ProfessionMetricDaily.region_id == national.id,
            )
        )
        assert retained is not None
        assert retained.salary_average == Decimal("140000")
        accumulated_history = _hh_metric_salary_history(
            db,
            profession.id,
            date_to=now.date(),
            days=10,
        )
        assert any(
            point.date == retained_date
            and point.median == 140000
            and point.average == 140000
            for point in accumulated_history
        )
    engine.dispose()
