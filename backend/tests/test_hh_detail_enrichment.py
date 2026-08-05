from datetime import date, datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.professions import _hh_market_enrichment_summary
from app.config import settings
from app.models import (
    Base,
    Profession,
    ProfessionCategory,
    Region,
    Vacancy,
    VacancySkill,
    VacancySource,
)
from app.providers.vacancies import HhVacancyDetails
from app.services.hh_detail_enrichment import enrich_hh_vacancy_details


class FakeDetailsProvider:
    def fetch_details(self, external_id: str) -> HhVacancyDetails:
        return HhVacancyDetails(
            external_id=external_id,
            skills=("Python", "SQL"),
            experience="between1And3",
            is_remote=True,
            raw={
                "provider": "hh_api",
                "schema_version": "hh-details-v1",
                "employer": {"id": "100", "name": "Example Corp"},
                "key_skills": ["Python", "SQL"],
                "employment": {"id": "full", "name": "Полная занятость"},
                "work_format": [{"id": "REMOTE", "name": "Удалённо"}],
                "experience": {"id": "between1And3", "name": "1–3 года"},
            },
        )


def _catalog(db: Session):
    category = ProfessionCategory(slug="development", name_ru="Разработка")
    region = Region(code="ru", name_ru="Россия")
    source = VacancySource(
        code="hh_api",
        name="HeadHunter",
        provider_type="HhApiProvider",
        enabled=True,
    )
    db.add_all((category, region, source))
    db.flush()
    profession = Profession(
        slug="python-developer",
        name_ru="Python-разработчик",
        name_en="Python Developer",
        description="Разработка приложений и сервисов на Python.",
        category_id=category.id,
        is_active=True,
    )
    db.add(profession)
    db.flush()
    return profession, region, source


def test_hh_detail_enrichment_is_safe_resumable_and_stores_skills(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    monkeypatch.setattr(settings, "hh_enabled", True)
    with Session(engine) as db:
        profession, region, source = _catalog(db)
        now = datetime.now(timezone.utc)
        vacancy = Vacancy(
            source_id=source.id,
            external_id="42",
            title="Python developer",
            region_id=region.id,
            published_at=now,
            first_seen_at=now,
            last_seen_at=now,
            profession_id=profession.id,
            raw_payload={"provider": "hh_api", "description": "legacy field"},
        )
        db.add(vacancy)
        db.commit()

        result = enrich_hh_vacancy_details(
            db,
            provider=FakeDetailsProvider(),  # type: ignore[arg-type]
            request_delay_seconds=0,
        )
        second = enrich_hh_vacancy_details(
            db,
            provider=FakeDetailsProvider(),  # type: ignore[arg-type]
            request_delay_seconds=0,
        )

        refreshed = db.get(Vacancy, vacancy.id)
        assert refreshed is not None
        assert result.status == "success"
        assert result.enriched == 1
        assert result.skills_added == 2
        assert second.attempted == 0
        assert second.skipped == 1
        assert refreshed.raw_payload["details"]["status"] == "ok"
        assert "contacts" not in refreshed.raw_payload["details"]
        assert refreshed.is_remote is True
        assert db.scalars(select(VacancySkill.skill).order_by(VacancySkill.skill)).all() == [
            "Python",
            "SQL",
        ]
    engine.dispose()


def test_hh_employer_aggregate_is_top_five_plus_other():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        profession, region, source = _catalog(db)
        now = datetime.now(timezone.utc)
        counts = [7, 6, 5, 4, 3, 2, 1]
        sequence = 0
        for company_index, count in enumerate(counts, start=1):
            for _ in range(count):
                sequence += 1
                vacancy = Vacancy(
                    source_id=source.id,
                    external_id=str(sequence),
                    title="Python developer",
                    region_id=region.id,
                    published_at=now,
                    first_seen_at=now,
                    last_seen_at=now,
                    profession_id=profession.id,
                    raw_payload={
                        "provider": "hh_api",
                        "details": {
                            "schema_version": "hh-details-v1",
                            "status": "ok",
                            "employer": {
                                "id": str(company_index),
                                "name": f"Company {company_index}",
                            },
                            "experience": {"id": "between1And3", "name": "1–3 года"},
                        },
                    },
                )
                db.add(vacancy)
                db.flush()
                db.add(
                    VacancySkill(
                        vacancy_id=vacancy.id,
                        skill="Python",
                        normalized_skill="python",
                    )
                )
        db.commit()

        summary = _hh_market_enrichment_summary(
            db,
            profession.id,
            source.id,
            date_from=date.today() - timedelta(days=364),
            date_to=date.today(),
        )

        assert summary.distinct_employer_count == 7
        assert [item.name for item in summary.employer_distribution[:5]] == [
            "Company 1",
            "Company 2",
            "Company 3",
            "Company 4",
            "Company 5",
        ]
        assert summary.employer_distribution[-1].name == "Другие компании"
        assert summary.employer_distribution[-1].count == 3
        assert summary.top_skills[0].name == "Python"
        assert summary.top_skills[0].count == sum(counts)
    engine.dispose()
