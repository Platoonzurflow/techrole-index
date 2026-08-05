from __future__ import annotations

import argparse
import json

from app.database import SessionLocal
from app.services.hh_profession_metrics import refresh_hh_profession_metrics


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rebuild profession metric windows from exact HH vacancies."
    )
    parser.add_argument("--window-days", type=int, default=30)
    parser.add_argument("--history-days", type=int)
    args = parser.parse_args()
    with SessionLocal() as db:
        result = refresh_hh_profession_metrics(
            db,
            rolling_window_days=args.window_days,
            history_days=args.history_days,
        )
    print(json.dumps(result.to_dict(), ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
