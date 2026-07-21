from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models import (
    Base,
    Profession,
    ProfessionCategory,
    Region,
    SeniorityLevel,
    Vacancy,
    VacancySkill,
    VacancySource,
)
from app.services.reclassification import reclassify_rule_managed_vacancies


def test_reclassification_uses_static_aliases_and_skills_without_touching_ai() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        category = ProfessionCategory(slug="development", name_ru="Разработка")
        region = Region(code="ru", name_ru="Россия")
        middle = SeniorityLevel(code="middle", name_ru="Middle", sort_order=2)
        source = VacancySource(
            code="trudvsem_open",
            name="Работа России",
            provider_type="official_open_api",
            enabled=True,
        )
        db.add_all([category, region, middle, source])
        db.flush()
        computer_vision = Profession(
            slug="computer-vision-engineer",
            name_ru="Computer Vision-инженер",
            name_en="Computer Vision Engineer",
            description="Разработка систем компьютерного зрения.",
            category_id=category.id,
        )
        dotnet = Profession(
            slug="dotnet-developer",
            name_ru="C#/.NET-разработчик",
            name_en="C#/.NET Developer",
            description="Разработка приложений на платформе .NET.",
            category_id=category.id,
        )
        db.add_all([computer_vision, dotnet])
        db.flush()
        vacancies = [
            Vacancy(
                source_id=source.id,
                external_id="generic-cv",
                title="Инженер-программист",
                region_id=region.id,
                published_at=now,
                first_seen_at=now,
                last_seen_at=now,
                experience_code="between1and3",
                classification_confidence=Decimal("0.2"),
                classifier_version="rules-v1",
            ),
            Vacancy(
                source_id=source.id,
                external_id="dotnet-title",
                title="Программист .NET",
                region_id=region.id,
                published_at=now,
                first_seen_at=now,
                last_seen_at=now,
                classification_confidence=Decimal("0.2"),
                classifier_version="rules-v1",
            ),
            Vacancy(
                source_id=source.id,
                external_id="ai-owned",
                title="Программист",
                region_id=region.id,
                published_at=now,
                first_seen_at=now,
                last_seen_at=now,
                classification_confidence=Decimal("0.79"),
                classifier_version="ollama:qwen",
            ),
        ]
        db.add_all(vacancies)
        db.flush()
        db.add_all(
            [
                VacancySkill(
                    vacancy_id=vacancies[0].id,
                    skill="OpenCV",
                    normalized_skill="opencv",
                ),
                VacancySkill(
                    vacancy_id=vacancies[0].id,
                    skill="C++",
                    normalized_skill="c++",
                ),
                VacancySkill(
                    vacancy_id=vacancies[2].id,
                    skill="Python",
                    normalized_skill="python",
                ),
            ]
        )
        db.commit()

        dry_run = reclassify_rule_managed_vacancies(db, dry_run=True)
        assert dry_run.evaluated == 2
        assert dry_run.newly_classified == 2
        assert (
            db.scalar(select(Vacancy.profession_id).where(Vacancy.external_id == "generic-cv"))
            is None
        )

        result = reclassify_rule_managed_vacancies(db)
        assert result.classifier_version == "rules-v2"
        assert result.evaluated == 2
        assert result.classified_before == 0
        assert result.classified_after == 2
        assert result.newly_classified == 2

        cv_row = db.scalar(select(Vacancy).where(Vacancy.external_id == "generic-cv"))
        dotnet_row = db.scalar(select(Vacancy).where(Vacancy.external_id == "dotnet-title"))
        ai_row = db.scalar(select(Vacancy).where(Vacancy.external_id == "ai-owned"))
        assert cv_row is not None and cv_row.profession_id == computer_vision.id
        assert cv_row.seniority_id == middle.id
        assert dotnet_row is not None and dotnet_row.profession_id == dotnet.id
        assert ai_row is not None and ai_row.classifier_version == "ollama:qwen"
        assert ai_row.profession_id is None
    engine.dispose()
