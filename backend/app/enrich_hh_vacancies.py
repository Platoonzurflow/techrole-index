from __future__ import annotations

import argparse
import json

from app.config import settings
from app.database import SessionLocal
from app.services.hh_detail_enrichment import enrich_hh_vacancy_details


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Resumably enrich classified HH vacancies with safe public details."
    )
    parser.add_argument(
        "--max-records",
        type=int,
        default=settings.hh_detail_max_records_per_run,
    )
    parser.add_argument("--batch-size", type=int, default=settings.hh_detail_batch_size)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        result = enrich_hh_vacancy_details(
            db,
            max_records=max(args.max_records, 1),
            batch_size=max(args.batch_size, 1),
            force=args.force,
        )
    print(json.dumps(result.to_dict(), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
