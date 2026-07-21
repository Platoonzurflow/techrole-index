from __future__ import annotations

import argparse
import json
from datetime import date

from app.database import SessionLocal
from app.services.publication_metrics import refresh_observed_publication_metrics


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected YYYY-MM-DD") from exc


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Incrementally materialize isolated observed publication metrics."
    )
    parser.add_argument("--source", default="trudvsem_open")
    parser.add_argument("--date-from", type=_date)
    parser.add_argument("--date-to", type=_date)
    parser.add_argument("--overlap-days", type=int, default=7)
    args = parser.parse_args()
    with SessionLocal() as db:
        result = refresh_observed_publication_metrics(
            db,
            source_code=args.source,
            date_from=args.date_from,
            date_to=args.date_to,
            overlap_days=args.overlap_days,
        )
    print(json.dumps(result.to_dict(), ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
