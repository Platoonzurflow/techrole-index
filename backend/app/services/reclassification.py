from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import SeniorityLevel, Vacancy, VacancySkill, VacancySource
from app.services.open_data_ingestion import build_rule_classifier


@dataclass(frozen=True)
class ReclassificationSummary:
    source: str
    classifier_version: str
    evaluated: int
    changed: int
    classified_before: int
    classified_after: int
    newly_classified: int
    cleared: int
    dry_run: bool

    def to_dict(self) -> dict:
        return asdict(self)


def reclassify_rule_managed_vacancies(
    db: Session,
    *,
    source_code: str = "trudvsem_open",
    dry_run: bool = False,
) -> ReclassificationSummary:
    """Re-run deterministic rules without overwriting AI or manual classifications."""
    source = db.scalar(select(VacancySource).where(VacancySource.code == source_code))
    if source is None:
        raise ValueError(f"Vacancy source not found: {source_code}")

    rules, professions = build_rule_classifier(db)
    levels = {
        level.code: level
        for level in db.scalars(select(SeniorityLevel).order_by(SeniorityLevel.id)).all()
    }
    vacancies = db.scalars(
        select(Vacancy)
        .where(
            Vacancy.source_id == source.id,
            or_(
                Vacancy.classifier_version.is_(None),
                Vacancy.classifier_version.like("rules-%"),
            ),
        )
        .order_by(Vacancy.id)
    ).all()
    vacancy_ids = [vacancy.id for vacancy in vacancies]
    skills_by_vacancy: dict[int, list[str]] = defaultdict(list)
    if vacancy_ids:
        for vacancy_id, skill in db.execute(
            select(VacancySkill.vacancy_id, VacancySkill.skill)
            .where(VacancySkill.vacancy_id.in_(vacancy_ids))
            .order_by(VacancySkill.vacancy_id, VacancySkill.id)
        ):
            skills_by_vacancy[vacancy_id].append(skill)

    classified_before = sum(vacancy.profession_id is not None for vacancy in vacancies)
    changed = newly_classified = cleared = 0
    for vacancy in vacancies:
        previous_profession_id = vacancy.profession_id
        classification = rules.classify(
            vacancy.title,
            vacancy.experience_code,
            skills_by_vacancy[vacancy.id],
        )
        profession = professions.get(classification.profession_slug or "")
        level = levels.get(classification.seniority or "")
        profession_id = profession.id if profession is not None else None
        level_id = level.id if level is not None else None
        confidence = Decimal(str(classification.confidence))

        row_changed = any(
            (
                vacancy.profession_id != profession_id,
                vacancy.seniority_id != level_id,
                vacancy.classification_confidence != confidence,
                vacancy.classifier_version != rules.version,
            )
        )
        changed += int(row_changed)
        newly_classified += int(previous_profession_id is None and profession_id is not None)
        cleared += int(previous_profession_id is not None and profession_id is None)

        vacancy.profession_id = profession_id
        vacancy.seniority_id = level_id
        vacancy.classification_confidence = confidence
        vacancy.classifier_version = rules.version

    classified_after = sum(vacancy.profession_id is not None for vacancy in vacancies)
    if dry_run:
        db.rollback()
    else:
        db.commit()
    return ReclassificationSummary(
        source=source_code,
        classifier_version=rules.version,
        evaluated=len(vacancies),
        changed=changed,
        classified_before=classified_before,
        classified_after=classified_after,
        newly_classified=newly_classified,
        cleared=cleared,
        dry_run=dry_run,
    )
