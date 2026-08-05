from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import IngestionRun, VacancyProfessionMatch


def latest_completed_hh_query_run_id(db: Session, source_id: int) -> int | None:
    """Return the latest complete HH run that actually stored query matches."""

    return db.scalar(
        select(func.max(VacancyProfessionMatch.last_run_id))
        .join(IngestionRun, IngestionRun.id == VacancyProfessionMatch.last_run_id)
        .where(
            IngestionRun.source_id == source_id,
            IngestionRun.status == "success",
        )
    )
