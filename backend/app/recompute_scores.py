from __future__ import annotations

import json

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import ProfessionScoreDaily, ScoringVersion
from app.services.scoring_service import recompute_scores


def main() -> None:
    with SessionLocal() as db:
        profession_count = recompute_scores(db)
        version = db.scalar(
            select(ScoringVersion)
            .where(ScoringVersion.is_active.is_(True))
            .order_by(ScoringVersion.created_at.desc())
        )
        score_date = db.scalar(
            select(func.max(ProfessionScoreDaily.score_date)).where(
                ProfessionScoreDaily.scoring_version_id == version.id
            )
        ) if version is not None else None
    print(
        json.dumps(
            {
                "status": "success" if profession_count else "skipped",
                "scoring_version": version.version if version else None,
                "score_date": score_date.isoformat() if score_date else None,
                "professions_recalculated": profession_count,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
