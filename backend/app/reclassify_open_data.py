from __future__ import annotations

import argparse
import json

from app.database import SessionLocal
from app.services.reclassification import reclassify_rule_managed_vacancies


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reclassify stored open-data vacancies with deterministic rules."
    )
    parser.add_argument("--source", default="trudvsem_open")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        result = reclassify_rule_managed_vacancies(
            db,
            source_code=args.source,
            dry_run=args.dry_run,
        )
    print(json.dumps(result.to_dict(), ensure_ascii=False))


if __name__ == "__main__":
    main()
