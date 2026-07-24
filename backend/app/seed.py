from __future__ import annotations

import argparse
import math
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select

from app.config import settings
from app.data.catalog import CATEGORIES, PROFESSIONS, profession_description
from app.data.salary_benchmarks import scoring_salary_benchmark
from app.database import SessionLocal, engine
from app.demo_accounts import DEMO_ACCOUNT_EMAILS
from app.domain.scoring import DEFAULT_WEIGHTS, SCORING_VERSION, ScoreInputs, calculate_score
from app.models import (
    Base,
    Entitlement,
    IngestionRun,
    Profession,
    ProfessionAlias,
    ProfessionCategory,
    ProfessionMetricDaily,
    ProfessionScoreDaily,
    Region,
    SalaryObservation,
    ScoringVersion,
    SeniorityLevel,
    User,
    Vacancy,
    VacancySkill,
    VacancySnapshot,
    VacancySource,
)
from app.providers.currency import DemoCurrencyRateProvider, normalize_amount
from app.providers.vacancies import DemoVacancyProvider
from app.security import hash_password

ANCHOR_DATE = date(2026, 7, 17)


def _confidence(sample: int, coverage: float) -> str:
    if sample < settings.min_salary_sample:
        return "insufficient"
    if sample < settings.min_salary_sample * 2 or coverage < 0.35:
        return "low"
    if sample < settings.min_salary_sample * 5 or coverage < 0.60:
        return "medium"
    return "high"


def _seed_reference(db) -> tuple[list[Profession], dict[str, SeniorityLevel], dict[str, Region]]:
    category_by_slug: dict[str, ProfessionCategory] = {}
    for slug, name, description in CATEGORIES:
        category_row = ProfessionCategory(slug=slug, name_ru=name, description=description)
        db.add(category_row)
        category_by_slug[slug] = category_row
    db.flush()

    professions: list[Profession] = []
    for index, (slug, name_ru, name_en, category_slug, aliases) in enumerate(PROFESSIONS):
        profession = Profession(
            slug=slug,
            name_ru=name_ru,
            name_en=name_en,
            description=profession_description(name_ru, name_en, category_slug),
            category_id=category_by_slug[category_slug].id,
            is_premium=index % 10 in {7, 8, 9},
        )
        db.add(profession)
        db.flush()
        professions.append(profession)
        for alias in aliases:
            db.add(ProfessionAlias(profession_id=profession.id, alias=alias))

    levels = {}
    for sort_order, (code, name) in enumerate(
        (("junior", "Junior"), ("middle", "Middle"), ("senior", "Senior")), 1
    ):
        item = SeniorityLevel(code=code, name_ru=name, sort_order=sort_order)
        db.add(item)
        levels[code] = item

    regions = {}
    for code, name in (
        ("ru", "Россия"),
        ("msk", "Москва"),
        ("spb", "Санкт-Петербург"),
        ("other", "Другие регионы"),
    ):
        region = Region(code=code, name_ru=name)
        db.add(region)
        regions[code] = region
    db.flush()
    return professions, levels, regions


def _seed_sources_and_scoring(
    db, *, demo_enabled: bool
) -> tuple[VacancySource, ScoringVersion]:
    demo_source = VacancySource(
        code="demo",
        name="Встроенный аналитический источник",
        provider_type="DemoVacancyProvider",
        enabled=demo_enabled,
    )
    hh_source = VacancySource(
        code="hh_api",
        name="Официальный API российского сервиса вакансий (выключен)",
        provider_type="HhApiProvider",
        enabled=False,
        terms_url="https://dev.hh.ru/",
    )
    trudvsem_source = VacancySource(
        code="trudvsem_open",
        name="Работа России - официальный открытый API",
        provider_type="TrudvsemOpenDataProvider",
        enabled=settings.trudvsem_enabled,
        terms_url=settings.trudvsem_terms_url,
    )
    db.add_all([demo_source, hh_source, trudvsem_source])
    scoring = ScoringVersion(
        version=SCORING_VERSION,
        weights=DEFAULT_WEIGHTS,
        description=(
            "Карьерный индекс: prepared demand/growth/access/remote, "
            "публичный salary benchmark и повышенный вес качества; METHODOLOGY.md."
        ),
        is_active=True,
    )
    db.add(scoring)
    db.flush()

    return demo_source, scoring


def _seed_demo_users(db) -> None:
    users = [
        User(
            email=DEMO_ACCOUNT_EMAILS["free"],
            display_name="Базовый пользователь",
            role="user",
            password_hash=hash_password(settings.demo_free_password),
        ),
        User(
            email=DEMO_ACCOUNT_EMAILS["premium"],
            display_name="Premium пользователь",
            role="user",
            password_hash=hash_password(settings.demo_premium_password),
        ),
        User(
            email=DEMO_ACCOUNT_EMAILS["admin"],
            display_name="Администратор",
            role="admin",
            password_hash=hash_password(settings.demo_admin_password),
        ),
    ]
    db.add_all(users)
    db.flush()
    now = datetime(2026, 7, 17, 9, 0, tzinfo=timezone.utc)
    db.add(
        Entitlement(
            user_id=users[1].id,
            code="premium",
            source="demo_seed",
            starts_at=now,
            ends_at=now + timedelta(days=3650),
        )
    )


def _assert_production_catalog_safe(db) -> None:
    demo_users = db.scalar(
        select(func.count(User.id)).where(User.email.in_(DEMO_ACCOUNT_EMAILS.values()))
    ) or 0
    enabled_demo_source = db.scalar(
        select(VacancySource.id).where(
            VacancySource.code == "demo", VacancySource.enabled.is_(True)
        )
    )
    if demo_users or enabled_demo_source is not None:
        raise RuntimeError(
            "Production bootstrap refused: demo accounts or an enabled demo source "
            "are present. Use a clean production database or an explicit reviewed cleanup migration."
        )


def _metric_rows(professions, levels, regions) -> list[dict]:
    rng = random.Random(settings.demo_seed)
    level_salary = {"junior": 0.62, "middle": 1.0, "senior": 1.53}
    level_demand = {"junior": 0.24, "middle": 0.48, "senior": 0.28}
    region_factor = {"ru": 1.0, "msk": 0.44, "spb": 0.19, "other": 0.37}
    rows = []
    for index, profession in enumerate(professions):
        base_salary = (
            145_000 + (index % 11) * 11_500 + (30_000 if index in {18, 19, 34, 35, 49} else 0)
        )
        base_demand = max(3, 120 - index * 2 + (45 if index in {0, 1, 3, 4, 18, 29} else 0))
        if index >= 44:
            base_demand = 5 + (index % 3)
        slope = 0.32 if index % 3 == 0 else -0.24 if index % 3 == 1 else 0.015
        coverage_base = 0.28 + (index % 7) * 0.075
        remote_base = min(0.82, 0.22 + (index % 9) * 0.065)
        for day_offset in range(180):
            metric_date = ANCHOR_DATE - timedelta(days=179 - day_offset)
            progress = day_offset / 179
            seasonality = math.sin(day_offset / 9 + index) * 0.045
            for level_code, level in levels.items():
                for region_code, region in regions.items():
                    jitter = rng.uniform(-0.035, 0.035)
                    vacancy_count = max(
                        1,
                        round(
                            base_demand
                            * level_demand[level_code]
                            * region_factor[region_code]
                            * (1 + slope * progress + seasonality + jitter)
                        ),
                    )
                    coverage = max(0.12, min(0.86, coverage_base + rng.uniform(-0.04, 0.04)))
                    salary_count = round(vacancy_count * coverage)
                    if index >= 44:
                        salary_count = min(salary_count, 6)
                    trend_salary = (
                        1 + slope * progress * 0.35 + math.sin(day_offset / 25 + index) * 0.018
                    )
                    salary = round(
                        base_salary
                        * level_salary[level_code]
                        * trend_salary
                        * (1.09 if region_code == "msk" else 1.0),
                        2,
                    )
                    enough = salary_count >= settings.min_salary_sample
                    rows.append(
                        {
                            "metric_date": metric_date,
                            "profession_id": profession.id,
                            "seniority_id": level.id,
                            "region_id": region.id,
                            "gross": True,
                            "vacancy_count": vacancy_count,
                            "salary_count": salary_count,
                            "salary_coverage": Decimal(str(round(coverage, 5))),
                            "salary_median": Decimal(str(salary)) if enough else None,
                            "salary_average": Decimal(
                                str(round(salary * (1.015 + rng.uniform(-0.01, 0.01)), 2))
                            )
                            if enough
                            else None,
                            "salary_p25": Decimal(str(round(salary * 0.82, 2))) if enough else None,
                            "salary_p75": Decimal(str(round(salary * 1.24, 2))) if enough else None,
                            "lower_bound_median": Decimal(str(round(salary * 0.85, 2)))
                            if salary_count
                            else None,
                            "upper_bound_median": Decimal(str(round(salary * 1.17, 2)))
                            if salary_count
                            else None,
                            "sample_size": salary_count,
                            "confidence_level": _confidence(salary_count, coverage),
                            "remote_share": Decimal(
                                str(
                                    round(
                                        max(
                                            0.05, min(0.92, remote_base + rng.uniform(-0.04, 0.04))
                                        ),
                                        5,
                                    )
                                )
                            ),
                        }
                    )
    return rows


def _seed_metrics(db, professions, levels, regions, scoring):
    rows = _metric_rows(professions, levels, regions)
    for start in range(0, len(rows), 5000):
        db.bulk_insert_mappings(ProfessionMetricDaily, rows[start : start + 5000])
    db.flush()

    current_rows = [
        row
        for row in rows
        if row["metric_date"] == ANCHOR_DATE
        and row["region_id"] == regions["ru"].id
        and row["seniority_id"] == levels["middle"].id
    ]
    category_slugs = {
        category.id: category.slug
        for category in db.scalars(select(ProfessionCategory)).all()
    }
    demand_peers = [float(row["vacancy_count"]) for row in current_rows]
    salary_peers = [
        scoring_salary_benchmark(
            profession.slug,
            category_slugs[profession.category_id],
        )
        for profession in professions
    ]
    growth_peers = [
        0.32 if i % 3 == 0 else -0.24 if i % 3 == 1 else 0.015 for i in range(len(professions))
    ]
    for index, (profession, row) in enumerate(zip(professions, current_rows, strict=True)):
        salary_benchmark = scoring_salary_benchmark(
            profession.slug,
            category_slugs[profession.category_id],
        )
        inputs = ScoreInputs(
            vacancy_count=float(row["vacancy_count"]),
            salary_median=salary_benchmark,
            demand_growth_percent=growth_peers[index] * 100,
            junior_share=0.13 + (index % 6) * 0.035,
            remote_share=float(row["remote_share"]),
            salary_coverage=float(row["salary_coverage"]),
            sample_size=int(row["sample_size"]),
        )
        result = calculate_score(
            inputs,
            demand_peers=demand_peers,
            salary_peers=salary_peers,
            growth_peers=[value * 100 for value in growth_peers],
        )
        db.add(
            ProfessionScoreDaily(
                score_date=ANCHOR_DATE,
                profession_id=profession.id,
                scoring_version_id=scoring.id,
                score=Decimal(str(result.score)),
                breakdown=result.breakdown,
                data_confidence=result.data_confidence,
            )
        )


def _seed_vacancies(db, professions, levels, regions, demo_source):
    provider = DemoVacancyProvider(settings.demo_seed)
    rates = DemoCurrencyRateProvider()
    skill_by_category = {
        "development": ("Git", "Docker", "REST API"),
        "quality": ("Pytest", "Playwright", "CI/CD"),
        "infrastructure": ("Linux", "Kubernetes", "Terraform"),
        "analytics": ("SQL", "BI", "A/B-тесты"),
        "data-ai": ("Python", "SQL", "Airflow"),
        "security": ("SIEM", "Linux", "Threat modeling"),
        "specialized": ("C++", "Git", "Debugging"),
        "architecture": ("System design", "API", "Cloud"),
    }
    category_slugs = {
        category.id: category.slug for category in db.scalars(select(ProfessionCategory)).all()
    }
    now = datetime(2026, 7, 17, 9, 0, tzinfo=timezone.utc)
    for profession in professions:
        for index, record in enumerate(provider.fetch(profession.name_en, "msk", limit=3)):
            level = levels[("junior", "middle", "senior")[index]]
            vacancy = Vacancy(
                source_id=demo_source.id,
                external_id=record.external_id,
                title=record.title,
                region_id=regions["msk"].id,
                currency=record.currency,
                salary_gross=record.gross,
                salary_from=record.salary_from,
                salary_to=record.salary_to,
                published_at=record.published_at,
                first_seen_at=record.published_at,
                last_seen_at=now,
                work_format="remote" if record.is_remote else "hybrid",
                is_remote=record.is_remote,
                experience_code=record.experience,
                profession_id=profession.id,
                seniority_id=level.id,
                classification_confidence=Decimal("0.9600"),
                classifier_version="rules-v1",
                raw_payload=record.raw,
            )
            db.add(vacancy)
            db.flush()
            db.add(
                VacancySnapshot(
                    vacancy_id=vacancy.id,
                    snapshot_date=ANCHOR_DATE,
                    is_active=True,
                    salary_from=record.salary_from,
                    salary_to=record.salary_to,
                )
            )
            for skill in skill_by_category[category_slugs[profession.category_id]]:
                db.add(
                    VacancySkill(vacancy_id=vacancy.id, skill=skill, normalized_skill=skill.lower())
                )
            if record.currency and (record.salary_from is not None or record.salary_to is not None):
                lower = normalize_amount(record.salary_from, record.currency, ANCHOR_DATE, rates)
                upper = normalize_amount(record.salary_to, record.currency, ANCHOR_DATE, rates)
                midpoint = (lower + upper) / 2 if lower is not None and upper is not None else None
                db.add(
                    SalaryObservation(
                        vacancy_id=vacancy.id,
                        observed_date=ANCHOR_DATE,
                        original_currency=record.currency,
                        normalized_currency="RUB",
                        rate=rates.rate_to_rub(record.currency, ANCHOR_DATE),
                        gross=record.gross,
                        salary_from=lower,
                        salary_to=upper,
                        midpoint=midpoint,
                        rate_provider=rates.name,
                    )
                )
    db.add(
        IngestionRun(
            source_id=demo_source.id,
            started_at=now - timedelta(minutes=2),
            finished_at=now,
            status="success",
            records_seen=len(professions) * 3,
            records_changed=len(professions) * 3,
            metadata_json={"seed": settings.demo_seed, "synthetic": True},
        )
    )


def seed(*, force: bool = False, demo_data: bool | None = None) -> None:
    include_demo_data = settings.demo_mode if demo_data is None else demo_data
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        existing = db.scalar(select(func.count(Profession.id))) or 0
        if existing and not force:
            if not include_demo_data:
                _assert_production_catalog_safe(db)
            print(f"Reference catalog already present ({existing} professions); skipping.")
            return
        if force:
            Base.metadata.drop_all(engine)
            Base.metadata.create_all(engine)
        professions, levels, regions = _seed_reference(db)
        demo_source, scoring = _seed_sources_and_scoring(
            db, demo_enabled=include_demo_data
        )
        if include_demo_data:
            _seed_demo_users(db)
            _seed_metrics(db, professions, levels, regions, scoring)
            _seed_vacancies(db, professions, levels, regions, demo_source)
        db.commit()
        if include_demo_data:
            print(f"Seeded {len(professions)} professions and 180 days ending {ANCHOR_DATE}.")
        else:
            print(f"Bootstrapped {len(professions)} professions without demo users or metrics.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force", action="store_true", help="Recreate all application tables before seeding"
    )
    args = parser.parse_args()
    seed(force=args.force)
