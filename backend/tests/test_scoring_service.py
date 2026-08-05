from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Profession, ProfessionCategory, Region, Vacancy, VacancySource
from app.services.scoring_service import _hh_score_dataset


def test_hh_score_dataset_uses_only_each_professions_own_observations() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    now = datetime(2026, 8, 5, 12, tzinfo=timezone.utc)
    with Session(engine) as db:
        category = ProfessionCategory(slug="development", name_ru="Разработка")
        region = Region(code="ru", name_ru="Россия")
        source = VacancySource(
            code="hh_api",
            name="HH API",
            provider_type="HhApiProvider",
            enabled=True,
        )
        db.add_all([category, region, source])
        db.flush()
        common = Profession(
            slug="common-role",
            name_ru="Частая роль",
            name_en="Common role",
            description="",
            category_id=category.id,
        )
        rare = Profession(
            slug="rare-role",
            name_ru="Редкая роль",
            name_en="Rare role",
            description="",
            category_id=category.id,
        )
        db.add_all([common, rare])
        db.flush()

        for index in range(5):
            db.add(
                Vacancy(
                    source_id=source.id,
                    external_id=f"common-{index}",
                    title="Common",
                    region_id=region.id,
                    currency="RUB",
                    salary_gross=True,
                    salary_from=Decimal("100000") + index * 1000,
                    salary_to=Decimal("200000") + index * 1000,
                    published_at=now - timedelta(days=index),
                    first_seen_at=now,
                    last_seen_at=now,
                    is_remote=index < 2,
                    experience_code="noExperience" if index == 0 else "between1And3",
                    profession_id=common.id,
                )
            )
        for index in range(2):
            db.add(
                Vacancy(
                    source_id=source.id,
                    external_id=f"rare-{index}",
                    title="Rare",
                    region_id=region.id,
                    currency="RUB",
                    salary_gross=True,
                    salary_from=Decimal("900000"),
                    salary_to=Decimal("1000000"),
                    published_at=now - timedelta(days=index),
                    first_seen_at=now,
                    last_seen_at=now,
                    is_remote=True,
                    experience_code="noExperience",
                    profession_id=rare.id,
                )
            )
        db.commit()

        result = _hh_score_dataset(db)
        assert result is not None
        score_date, rows, salary_peers = result
        assert score_date == now.date()
        assert rows[common.id].vacancy_count == 5
        assert rows[common.id].salary_median == 152000
        assert rows[common.id].remote_share == 0.4
        assert rows[rare.id].vacancy_count == 2
        assert rows[rare.id].salary_median == 152000
        assert rows[rare.id].demand_growth_percent == 0
        assert rows[rare.id].remote_share == 1
        assert salary_peers == [152000]
    engine.dispose()
