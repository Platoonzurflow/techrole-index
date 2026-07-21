from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.data.catalog import ALIASES_BY_PROFESSION
from app.domain.classifier import RuleBasedClassifier
from app.models import (
    IngestionRun,
    Profession,
    ProfessionAlias,
    Region,
    SalaryObservation,
    SeniorityLevel,
    SourceQuery,
    Vacancy,
    VacancySkill,
    VacancySnapshot,
    VacancySource,
)
from app.providers.ai import OllamaOptionalClassifier
from app.providers.vacancies import TrudvsemOpenDataProvider, VacancyDataProvider


@dataclass(frozen=True)
class OpenDataIngestionSummary:
    run_id: int
    status: str
    source: str
    records_seen: int
    records_changed: int
    classified_by_rules: int
    classified_by_ai: int
    unclassified: int
    query_errors: int
    queries_attempted: int
    pages_fetched: int
    raw_records_fetched: int
    duplicates_skipped: int
    records_outside_window: int
    history_days: int
    metrics_recalculated: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def _ensure_source(db: Session) -> VacancySource:
    source = db.scalar(select(VacancySource).where(VacancySource.code == "trudvsem_open"))
    if source is None:
        source = VacancySource(
            code="trudvsem_open",
            name="Работа России - официальный открытый API",
            provider_type="TrudvsemOpenDataProvider",
            enabled=settings.trudvsem_enabled,
            terms_url=settings.trudvsem_terms_url,
        )
        db.add(source)
        db.flush()
    else:
        source.enabled = settings.trudvsem_enabled
        source.terms_url = settings.trudvsem_terms_url
    return source


def build_rule_classifier(
    db: Session,
) -> tuple[RuleBasedClassifier, dict[str, Profession]]:
    professions = {
        item.slug: item
        for item in db.scalars(
            select(Profession).where(Profession.is_active.is_(True)).order_by(Profession.id)
        ).all()
    }
    aliases: dict[str, list[str]] = {slug: [] for slug in professions}
    exclusions: dict[str, list[str]] = {slug: [] for slug in professions}
    rows = db.execute(
        select(ProfessionAlias, Profession.slug)
        .join(Profession, ProfessionAlias.profession_id == Profession.id)
        .where(Profession.is_active.is_(True))
    ).all()
    for alias, slug in rows:
        aliases[slug].append(alias.alias)
        if alias.exclude_pattern:
            exclusions[slug].append(alias.exclude_pattern)
    for slug, profession in professions.items():
        aliases[slug].extend(ALIASES_BY_PROFESSION.get(slug, ()))
        aliases[slug].extend((profession.name_ru, profession.name_en))
    return RuleBasedClassifier(aliases, exclusions), professions


def _ensure_source_query(
    db: Session,
    *,
    source_id: int,
    profession_id: int,
    region_id: int,
    query: str,
) -> None:
    stored = db.scalar(
        select(SourceQuery).where(
            SourceQuery.source_id == source_id,
            SourceQuery.profession_id == profession_id,
            SourceQuery.region_id == region_id,
            SourceQuery.query_text == query,
        )
    )
    if stored is None:
        db.add(
            SourceQuery(
                source_id=source_id,
                profession_id=profession_id,
                region_id=region_id,
                query_text=query,
                enabled=True,
            )
        )


def _queries_for_profession(db: Session, profession: Profession) -> list[str]:
    candidates = [profession.name_ru]
    if settings.trudvsem_use_alias_queries:
        candidates.append(profession.name_en)
        candidates.extend(ALIASES_BY_PROFESSION.get(profession.slug, ()))
        candidates.extend(
            db.scalars(
                select(ProfessionAlias.alias)
                .where(
                    ProfessionAlias.profession_id == profession.id,
                    ProfessionAlias.is_regex.is_(False),
                )
                .order_by(ProfessionAlias.id)
            ).all()
        )
    queries: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        query = candidate.strip()
        normalized = query.casefold()
        if query and normalized not in seen:
            queries.append(query)
            seen.add(normalized)
    return queries


def _coarse_region(region_code: str, regions: dict[str, Region]) -> Region:
    normalized = region_code.strip()
    if normalized.startswith("77"):
        return regions["msk"]
    if normalized.startswith("78"):
        return regions["spb"]
    return regions["other"]


def _store_salary_observation(db: Session, vacancy: Vacancy, observed_at: datetime) -> None:
    if vacancy.currency != "RUB" or (vacancy.salary_from is None and vacancy.salary_to is None):
        return
    observed_date = observed_at.date()
    existing = db.scalar(
        select(SalaryObservation).where(
            SalaryObservation.vacancy_id == vacancy.id,
            SalaryObservation.observed_date == observed_date,
        )
    )
    if existing is not None:
        return
    midpoint = (
        (vacancy.salary_from + vacancy.salary_to) / 2
        if vacancy.salary_from is not None and vacancy.salary_to is not None
        else None
    )
    db.add(
        SalaryObservation(
            vacancy_id=vacancy.id,
            observed_date=observed_date,
            original_currency="RUB",
            normalized_currency="RUB",
            rate=Decimal("1"),
            gross=None,
            salary_from=vacancy.salary_from,
            salary_to=vacancy.salary_to,
            midpoint=midpoint,
            rate_provider="identity-rub-v1",
        )
    )


def ingest_trudvsem_open_data(
    db: Session,
    *,
    provider: VacancyDataProvider | None = None,
    ai_classifier: OllamaOptionalClassifier | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> OpenDataIngestionSummary:
    if not settings.trudvsem_enabled:
        raise RuntimeError("TRUDVSEM_ENABLED is false")

    source = _ensure_source(db)
    recovery_time = datetime.now(timezone.utc)
    stale_runs = db.scalars(
        select(IngestionRun).where(
            IngestionRun.source_id == source.id,
            IngestionRun.status == "running",
            IngestionRun.started_at < recovery_time - timedelta(hours=1),
        )
    ).all()
    for stale_run in stale_runs:
        stale_run.status = "failed"
        stale_run.finished_at = recovery_time
        stale_run.error_summary = "interrupted_before_completion"
        stale_run.metadata_json = {
            **(stale_run.metadata_json or {}),
            "recovered_at": recovery_time.isoformat(),
            "recovery_reason": "stale running state after process interruption",
        }
    if stale_runs:
        db.commit()
    rules, professions_by_slug = build_rule_classifier(db)
    regions = {item.code: item for item in db.scalars(select(Region)).all()}
    if not {"ru", "msk", "spb", "other"}.issubset(regions):
        raise RuntimeError("Required coarse regions are missing")
    national_region = regions["ru"]
    levels = {
        item.code: item
        for item in db.scalars(select(SeniorityLevel).order_by(SeniorityLevel.sort_order)).all()
    }
    professions = list(professions_by_slug.values())[: settings.trudvsem_max_professions]
    provider = provider or TrudvsemOpenDataProvider(settings)
    if (
        ai_classifier is None
        and settings.ai_classifier_enabled
        and settings.ai_classifier_max_per_run
    ):
        ai_classifier = OllamaOptionalClassifier(settings, set(professions_by_slug))

    started_at = datetime.now(timezone.utc)
    run = IngestionRun(
        source_id=source.id,
        started_at=started_at,
        status="running",
        records_seen=0,
        records_changed=0,
        metadata_json={
            "provider": source.code,
            "terms_url": settings.trudvsem_terms_url,
            "query_limit": settings.trudvsem_query_limit,
            "history_days": settings.trudvsem_history_days,
            "max_pages_per_query": settings.trudvsem_max_pages_per_query,
            "alias_queries": settings.trudvsem_use_alias_queries,
            "ai_model": settings.ollama_model if ai_classifier else None,
        },
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    seen = changed = by_rules = by_ai = unclassified = query_errors = 0
    queries_attempted = pages_fetched = raw_records_fetched = 0
    duplicates_skipped = records_outside_window = 0
    ai_used = 0
    errors: list[str] = []
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.trudvsem_history_days)
    future_limit = now + timedelta(days=1)
    processed_external_ids: set[str] = set()
    oldest_published_at: datetime | None = None
    newest_published_at: datetime | None = None
    try:
        for profession in professions:
            for query in _queries_for_profession(db, profession):
                queries_attempted += 1
                _ensure_source_query(
                    db,
                    source_id=source.id,
                    profession_id=profession.id,
                    region_id=national_region.id,
                    query=query,
                )
                for page in range(settings.trudvsem_max_pages_per_query):
                    try:
                        records = list(
                            provider.fetch(
                                query,
                                "ru",
                                limit=settings.trudvsem_query_limit,
                                offset=page,
                            )
                        )
                    except Exception as exc:
                        query_errors += 1
                        errors.append(f"{profession.slug}:{page}:{type(exc).__name__}")
                        db.rollback()
                        break

                    pages_fetched += 1
                    raw_records_fetched += len(records)
                    if not records:
                        break

                    for record in records:
                        if not cutoff <= record.published_at <= future_limit:
                            records_outside_window += 1
                            continue
                        if record.external_id in processed_external_ids:
                            duplicates_skipped += 1
                            continue
                        processed_external_ids.add(record.external_id)
                        seen += 1
                        oldest_published_at = min(
                            oldest_published_at or record.published_at,
                            record.published_at,
                        )
                        newest_published_at = max(
                            newest_published_at or record.published_at,
                            record.published_at,
                        )

                        classification = rules.classify(
                            record.title,
                            record.experience,
                            record.skills,
                        )
                        classifier_version = rules.version
                        if (
                            ai_classifier is not None
                            and ai_used < settings.ai_classifier_max_per_run
                            and (
                                classification.profession_slug is None
                                or classification.confidence < 0.55
                            )
                        ):
                            ai_used += 1
                            try:
                                assisted = ai_classifier.classify(
                                    record.title, " ".join(record.skills)
                                )
                            except Exception as exc:
                                errors.append(f"ai:{type(exc).__name__}")
                                assisted = None
                            if (
                                assisted is not None
                                and assisted.confidence > classification.confidence
                            ):
                                classification = assisted
                                classifier_version = f"ollama:{settings.ollama_model}"

                        profession_match = professions_by_slug.get(
                            classification.profession_slug or ""
                        )
                        level = levels.get(classification.seniority or "")
                        if profession_match is None:
                            unclassified += 1
                        elif classifier_version == rules.version:
                            by_rules += 1
                        else:
                            by_ai += 1

                        target_region = _coarse_region(record.region_code, regions)
                        vacancy = db.scalar(
                            select(Vacancy).where(
                                Vacancy.source_id == source.id,
                                Vacancy.external_id == record.external_id,
                            )
                        )
                        if vacancy is None:
                            vacancy = Vacancy(
                                source_id=source.id,
                                external_id=record.external_id,
                                first_seen_at=now,
                                region_id=target_region.id,
                                title=record.title,
                                published_at=record.published_at,
                                last_seen_at=now,
                            )
                            db.add(vacancy)
                            changed += 1
                        else:
                            changed += int(
                                vacancy.title != record.title
                                or vacancy.salary_from != record.salary_from
                                or vacancy.salary_to != record.salary_to
                                or vacancy.region_id != target_region.id
                                or vacancy.profession_id
                                != (profession_match.id if profession_match else None)
                            )
                        vacancy.title = record.title
                        vacancy.region_id = target_region.id
                        vacancy.currency = record.currency
                        vacancy.salary_gross = record.gross
                        vacancy.salary_from = record.salary_from
                        vacancy.salary_to = record.salary_to
                        vacancy.published_at = record.published_at
                        vacancy.last_seen_at = now
                        vacancy.work_format = "remote" if record.is_remote else "office"
                        vacancy.is_remote = record.is_remote
                        vacancy.experience_code = record.experience
                        vacancy.profession_id = profession_match.id if profession_match else None
                        vacancy.seniority_id = level.id if level else None
                        vacancy.classification_confidence = Decimal(str(classification.confidence))
                        vacancy.classifier_version = classifier_version
                        vacancy.raw_payload = record.raw
                        db.flush()

                        snapshot = db.scalar(
                            select(VacancySnapshot).where(
                                VacancySnapshot.vacancy_id == vacancy.id,
                                VacancySnapshot.snapshot_date == now.date(),
                            )
                        )
                        if snapshot is None:
                            db.add(
                                VacancySnapshot(
                                    vacancy_id=vacancy.id,
                                    snapshot_date=now.date(),
                                    is_active=True,
                                    salary_from=record.salary_from,
                                    salary_to=record.salary_to,
                                )
                            )
                        existing_skills = set(
                            db.scalars(
                                select(VacancySkill.normalized_skill).where(
                                    VacancySkill.vacancy_id == vacancy.id
                                )
                            ).all()
                        )
                        for skill in record.skills[:30]:
                            # The database key is capped at 120 characters.  Compare the
                            # persisted representation as well, otherwise two long skills
                            # with the same prefix can pass this in-memory check and violate
                            # the unique constraint during flush.
                            normalized = skill.lower().strip()[:120]
                            if normalized and normalized not in existing_skills:
                                db.add(
                                    VacancySkill(
                                        vacancy_id=vacancy.id,
                                        skill=skill[:120],
                                        normalized_skill=normalized,
                                    )
                                )
                                existing_skills.add(normalized)
                        _store_salary_observation(db, vacancy, now)

                    db.commit()
                    if len(records) < settings.trudvsem_query_limit:
                        break
                    if settings.trudvsem_request_delay_seconds:
                        sleep(settings.trudvsem_request_delay_seconds)
    finally:
        if ai_classifier is not None:
            ai_classifier.unload()

    refreshed_run = db.get(IngestionRun, run.id)
    if refreshed_run is None:
        raise RuntimeError("Ingestion run disappeared")
    run = refreshed_run
    run.finished_at = datetime.now(timezone.utc)
    run.records_seen = seen
    run.records_changed = changed
    run.status = "partial" if query_errors or errors else "success"
    run.error_summary = ";".join(errors[:50]) or None
    run.metadata_json = {
        **(run.metadata_json or {}),
        "classified_by_rules": by_rules,
        "classified_by_ai": by_ai,
        "unclassified": unclassified,
        "query_errors": query_errors,
        "queries_attempted": queries_attempted,
        "pages_fetched": pages_fetched,
        "raw_records_fetched": raw_records_fetched,
        "duplicates_skipped": duplicates_skipped,
        "records_outside_window": records_outside_window,
        "window_start": cutoff.isoformat(),
        "window_end": now.isoformat(),
        "oldest_published_at": oldest_published_at.isoformat() if oldest_published_at else None,
        "newest_published_at": newest_published_at.isoformat() if newest_published_at else None,
        "metrics_recalculated": False,
        "metrics_note": (
            "official publication records were loaded; gross/net semantics and historical "
            "active-state are unknown, so salary/active-vacancy metrics were not overwritten"
        ),
    }
    db.commit()
    return OpenDataIngestionSummary(
        run_id=run.id,
        status=run.status,
        source=source.code,
        records_seen=seen,
        records_changed=changed,
        classified_by_rules=by_rules,
        classified_by_ai=by_ai,
        unclassified=unclassified,
        query_errors=query_errors,
        queries_attempted=queries_attempted,
        pages_fetched=pages_fetched,
        raw_records_fetched=raw_records_fetched,
        duplicates_skipped=duplicates_skipped,
        records_outside_window=records_outside_window,
        history_days=settings.trudvsem_history_days,
    )
