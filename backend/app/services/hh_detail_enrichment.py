from __future__ import annotations

import time
from collections import Counter
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Vacancy, VacancyProfessionMatch, VacancySkill, VacancySource
from app.providers.vacancies import HhApiProvider
from app.services.hh_query_matches import latest_completed_hh_query_run_id

HH_DETAILS_SCHEMA_VERSION = "hh-details-v1"
HH_DETAILS_KEY = "details"


@dataclass(frozen=True)
class HhDetailEnrichmentSummary:
    status: str
    scanned: int
    attempted: int
    enriched: int
    unavailable: int
    skipped: int
    errors: int
    skills_added: int
    error_types: dict[str, int]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _already_processed(raw_payload: dict, *, force: bool) -> bool:
    if force:
        return False
    details = raw_payload.get(HH_DETAILS_KEY)
    return bool(
        isinstance(details, dict)
        and details.get("schema_version") == HH_DETAILS_SCHEMA_VERSION
        and details.get("status") in {"ok", "unavailable"}
    )


def _store_skills(db: Session, vacancy: Vacancy, skills: tuple[str, ...]) -> int:
    existing = set(
        db.scalars(
            select(VacancySkill.normalized_skill).where(
                VacancySkill.vacancy_id == vacancy.id
            )
        ).all()
    )
    added = 0
    for skill in skills[:30]:
        normalized = skill.casefold().strip()[:120]
        if not normalized or normalized in existing:
            continue
        db.add(
            VacancySkill(
                vacancy_id=vacancy.id,
                skill=skill.strip()[:120],
                normalized_skill=normalized,
            )
        )
        existing.add(normalized)
        added += 1
    return added


def enrich_hh_vacancy_details(
    db: Session,
    *,
    provider: HhApiProvider | None = None,
    max_records: int | None = None,
    batch_size: int | None = None,
    request_delay_seconds: float | None = None,
    force: bool = False,
    sleep: Callable[[float], None] = time.sleep,
) -> HhDetailEnrichmentSummary:
    """Enrich query-matched HH vacancies with a deliberately safe details allowlist.

    The operation is resumable. Every successful or unavailable vacancy is marked with
    a schema version, and commits happen in small batches. Vacancy descriptions,
    contacts, addresses and response URLs never enter the database through this path.
    """

    if not settings.hh_enabled:
        raise RuntimeError("HH_ENABLED is false")
    source = db.scalar(select(VacancySource).where(VacancySource.code == "hh_api"))
    if source is None or not source.enabled:
        raise RuntimeError("HH source is not enabled")

    provider = provider or HhApiProvider(settings, sleep=sleep)
    match_run_id = latest_completed_hh_query_run_id(db, source.id)
    max_records = max_records or settings.hh_detail_max_records_per_run
    batch_size = batch_size or settings.hh_detail_batch_size
    delay = (
        settings.hh_detail_request_delay_seconds
        if request_delay_seconds is None
        else request_delay_seconds
    )

    scanned = attempted = enriched = unavailable = skipped = errors = skills_added = 0
    error_types: Counter[str] = Counter()
    last_id = 0
    pending_changes = 0

    while attempted < max_records:
        statement = select(Vacancy).where(
            Vacancy.source_id == source.id,
            Vacancy.id > last_id,
        )
        if match_run_id is not None:
            statement = statement.where(
                select(VacancyProfessionMatch.id)
                .where(
                    VacancyProfessionMatch.vacancy_id == Vacancy.id,
                    VacancyProfessionMatch.last_run_id == match_run_id,
                )
                .exists()
            )
        else:
            statement = statement.where(Vacancy.profession_id.is_not(None))
        vacancies = db.scalars(
            statement.order_by(Vacancy.id).limit(max(batch_size * 4, 200))
        ).all()
        if not vacancies:
            break

        for vacancy in vacancies:
            last_id = vacancy.id
            scanned += 1
            raw_payload = dict(vacancy.raw_payload or {})
            if _already_processed(raw_payload, force=force):
                skipped += 1
                continue
            if attempted >= max_records:
                break

            attempted += 1
            fetched_at = datetime.now(timezone.utc).isoformat()
            try:
                details = provider.fetch_details(vacancy.external_id)
            except Exception as exc:
                errors += 1
                error_types[type(exc).__name__] += 1
            else:
                if details is None:
                    raw_payload[HH_DETAILS_KEY] = {
                        "provider": "hh_api",
                        "schema_version": HH_DETAILS_SCHEMA_VERSION,
                        "status": "unavailable",
                        "fetched_at": fetched_at,
                    }
                    unavailable += 1
                else:
                    raw_payload[HH_DETAILS_KEY] = {
                        **details.raw,
                        "schema_version": HH_DETAILS_SCHEMA_VERSION,
                        "status": "ok",
                        "fetched_at": fetched_at,
                    }
                    skills_added += _store_skills(db, vacancy, details.skills)
                    if details.experience:
                        vacancy.experience_code = details.experience
                    vacancy.is_remote = details.is_remote
                    vacancy.work_format = "remote" if details.is_remote else "office"
                    enriched += 1
                vacancy.raw_payload = raw_payload
                pending_changes += 1

            if pending_changes >= batch_size:
                db.commit()
                pending_changes = 0
            if delay:
                sleep(delay)

    if pending_changes:
        db.commit()

    status = "success" if errors == 0 else ("partial" if enriched or unavailable else "failed")
    return HhDetailEnrichmentSummary(
        status=status,
        scanned=scanned,
        attempted=attempted,
        enriched=enriched,
        unavailable=unavailable,
        skipped=skipped,
        errors=errors,
        skills_added=skills_added,
        error_types=dict(error_types),
    )
