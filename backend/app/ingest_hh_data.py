from __future__ import annotations

import json

from app.database import SessionLocal
from app.services.open_data_ingestion import ingest_hh_data


def main() -> None:
    with SessionLocal() as db:
        result = ingest_hh_data(db)
    print(json.dumps(result.to_dict(), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
