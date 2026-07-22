from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit

import httpx
from sqlalchemy.orm import Session

from app.data.salary_benchmarks import HABR_CALCULATOR_MEDIANS, SOURCES
from app.models import AuditLog

SALARY_SOURCE_AUDIT_ACTION = "salary_source.public_metadata_audit"

AUDIT_USER_AGENT = (
    "TechRoleIndex/0.1 salary-source-audit; "
    "+mailto:sqldevelopermoscow@yandex.com"
)
MEDIAN_PATTERN = re.compile(
    r"(?:зарабатывает|зарплата)\s+([\d\s\u00a0]+?)\s*руб",
    re.IGNORECASE,
)


class _PublicMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.description = ""
        self.in_title = False
        self.title_parts: list[str] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag.casefold() == "title":
            self.in_title = True
            return
        if tag.casefold() != "meta" or self.description:
            return
        attributes = {key.casefold(): value or "" for key, value in attrs}
        if attributes.get("name", "").casefold() == "description":
            self.description = attributes.get("content", "").strip()

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return " ".join("".join(self.title_parts).split())


def _source_id(alias: str) -> str:
    return f"habr_calculator_{alias.lower()}_2026_07_22"


def _parse_public_median(html: str) -> tuple[str, str, int | None]:
    parser = _PublicMetadataParser()
    parser.feed(html)
    match = MEDIAN_PATTERN.search(parser.description)
    median = (
        int("".join(character for character in match.group(1) if character.isdigit()))
        if match
        else None
    )
    return parser.title, parser.description, median


def _audit_with_client(client: httpx.Client, *, attempts: int) -> dict[str, object]:
    entries: list[dict[str, object]] = []
    for slug, (alias, label, expected_median) in HABR_CALCULATOR_MEDIANS.items():
        url = SOURCES[_source_id(alias)]["url"]
        parsed_url = urlsplit(url)
        if parsed_url.scheme != "https" or parsed_url.hostname != "career.habr.com":
            raise ValueError("Salary source audit accepts only official Habr Career HTTPS URLs")

        response: httpx.Response | None = None
        last_error: httpx.HTTPError | None = None
        for _ in range(attempts):
            try:
                response = client.get(url)
                response.raise_for_status()
                break
            except httpx.HTTPError as exc:
                response = None
                last_error = exc
        if response is None:
            entries.append(
                {
                    "slug": slug,
                    "status": "unavailable",
                    "expected_median": expected_median,
                    "observed_median": None,
                    "source_url": url,
                    "error": type(last_error).__name__,
                }
            )
            continue

        title, description, observed_median = _parse_public_median(response.text)
        label_matches = label.casefold() in title.casefold()
        matches = label_matches and observed_median == expected_median
        entries.append(
            {
                "slug": slug,
                "status": "verified" if matches else "changed",
                "expected_median": expected_median,
                "observed_median": observed_median,
                "source_url": url,
                "title_matches": label_matches,
                "description_present": bool(description),
            }
        )

    verified = sum(entry["status"] == "verified" for entry in entries)
    changed = sum(entry["status"] == "changed" for entry in entries)
    unavailable = sum(entry["status"] == "unavailable" for entry in entries)
    status = "changed" if changed else "partial" if unavailable else "verified"
    return {
        "status": status,
        "checked": len(entries),
        "verified": verified,
        "changed": changed,
        "unavailable": unavailable,
        "entries": entries,
    }


def audit_habr_calculator_public_medians(
    *,
    client: httpx.Client | None = None,
    timeout_seconds: float = 15,
    attempts: int = 3,
) -> dict[str, object]:
    """Verify dated public metadata without reading account-gated calculator data."""
    attempts = max(1, min(3, attempts))
    if client is not None:
        return _audit_with_client(client, attempts=attempts)
    with httpx.Client(
        follow_redirects=True,
        headers={"User-Agent": AUDIT_USER_AGENT},
        timeout=timeout_seconds,
    ) as owned_client:
        return _audit_with_client(owned_client, attempts=attempts)


def record_salary_source_audit(
    db: Session,
    result: dict[str, object],
    *,
    occurred_at: datetime | None = None,
) -> AuditLog:
    """Persist one public-metadata check without changing benchmark values."""
    audit_log = AuditLog(
        occurred_at=occurred_at or datetime.now(timezone.utc),
        action=SALARY_SOURCE_AUDIT_ACTION,
        entity_type="salary_benchmark_snapshot",
        entity_id="habr_calculator_public_medians",
        details=result,
    )
    db.add(audit_log)
    db.flush()
    return audit_log


def main() -> int:
    result = audit_habr_calculator_public_medians()
    sys.stdout.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    if result["status"] == "changed":
        return 2
    if result["status"] == "partial":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
