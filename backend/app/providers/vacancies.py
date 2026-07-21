from __future__ import annotations

import hashlib
import random
import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Protocol

import httpx

from app.config import Settings


@dataclass(frozen=True)
class VacancyRecord:
    external_id: str
    title: str
    region_code: str
    salary_from: Decimal | None
    salary_to: Decimal | None
    currency: str | None
    gross: bool | None
    published_at: datetime
    experience: str | None
    is_remote: bool
    skills: tuple[str, ...]
    raw: dict


class VacancyDataProvider(Protocol):
    code: str

    def fetch(
        self, query: str, region_code: str, *, limit: int = 100, offset: int = 0
    ) -> Iterator[VacancyRecord]: ...


class DemoVacancyProvider:
    code = "demo"

    def __init__(self, seed: int = 20260717):
        self.seed = seed

    def fetch(
        self, query: str, region_code: str, *, limit: int = 100, offset: int = 0
    ) -> Iterator[VacancyRecord]:
        rng = random.Random(f"{self.seed}:{query}:{region_code}")
        now = datetime(2026, 7, 17, 9, 0, tzinfo=timezone.utc)
        levels = (("Junior", 0.65), ("Middle", 1.0), ("Senior", 1.55))
        currencies = ("RUB", "RUB", "RUB", "USD", "EUR", "KZT")
        start_index = max(offset, 0) * limit
        for index in range(start_index, start_index + limit):
            label, multiplier = levels[index % len(levels)]
            has_salary = rng.random() > 0.28
            two_bounds = has_salary and rng.random() > 0.12
            base = int(rng.uniform(100_000, 230_000) * multiplier)
            currency = rng.choice(currencies) if has_salary else None
            divisor = {"RUB": 1, "USD": 92.5, "EUR": 100.2, "KZT": 0.205}.get(currency or "RUB", 1)
            lower = Decimal(str(round(base * 0.85 / divisor, 2))) if has_salary else None
            upper = Decimal(str(round(base * 1.15 / divisor, 2))) if two_bounds else None
            yield VacancyRecord(
                external_id="demo-"
                + hashlib.sha256(f"{self.seed}:{query}:{region_code}:{index}".encode()).hexdigest()[
                    :16
                ],
                title=f"{label} {query}",
                region_code=region_code,
                salary_from=lower,
                salary_to=upper,
                currency=currency,
                gross=True if has_salary else None,
                published_at=now - timedelta(days=rng.randint(0, 45)),
                experience={
                    "Junior": "no_experience",
                    "Middle": "between1and3",
                    "Senior": "between3and6",
                }[label],
                is_remote=rng.random() < 0.42,
                skills=("Git", "SQL", "Docker"),
                raw={"provider": "demo", "synthetic": True},
            )


class HhApiProvider:
    """Official HH API only. No HTML scraping or limit bypassing."""

    code = "hh_api"
    base_url = "https://api.hh.ru"

    def __init__(self, settings: Settings):
        if not settings.hh_enabled:
            raise RuntimeError("HH provider is disabled")
        if not settings.hh_commercial_use_confirmed:
            raise RuntimeError("Commercial-use confirmation is required")
        self.user_agent = f"{settings.hh_app_name}/0.1 ({settings.hh_contact_email})"
        self.token = settings.hh_access_token

    def fetch(
        self, query: str, region_code: str, *, limit: int = 100, offset: int = 0
    ) -> Iterator[VacancyRecord]:
        if offset:
            return
        per_page = min(limit, 100)
        headers = {"HH-User-Agent": self.user_agent, "User-Agent": self.user_agent}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        # A single official API page is deliberate: no pagination-depth or rate-limit circumvention.
        response = httpx.get(
            f"{self.base_url}/vacancies",
            params={"text": query, "area": region_code, "per_page": per_page, "page": 0},
            headers=headers,
            timeout=20,
        )
        response.raise_for_status()
        for item in response.json().get("items", []):
            salary = item.get("salary") or {}
            yield VacancyRecord(
                external_id=str(item["id"]),
                title=item["name"],
                region_code=str(item.get("area", {}).get("id", region_code)),
                salary_from=Decimal(str(salary["from"]))
                if salary.get("from") is not None
                else None,
                salary_to=Decimal(str(salary["to"])) if salary.get("to") is not None else None,
                currency=salary.get("currency"),
                gross=salary.get("gross"),
                published_at=datetime.fromisoformat(item["published_at"]),
                experience=(item.get("experience") or {}).get("id"),
                is_remote=item.get("work_format", [{}])[0].get("id") == "REMOTE",
                skills=(),
                raw=item,
            )


class TrudvsemOpenDataProvider:
    """Official open-data API of the public employment portal Работа России."""

    code = "trudvsem_open"

    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        if not settings.trudvsem_enabled:
            raise RuntimeError("Trudvsem open-data provider is disabled")
        self.base_url = settings.trudvsem_base_url.rstrip("/")
        self.client = client or httpx.Client(
            timeout=30,
            headers={
                "User-Agent": (
                    "TechRoleIndex/0.1 open-data pipeline "
                    f"(contact: {settings.support_recipient_email})"
                )
            },
        )

    @staticmethod
    def _positive_decimal(value: object) -> Decimal | None:
        if value in (None, ""):
            return None
        amount = Decimal(str(value))
        return amount if amount > 0 else None

    @staticmethod
    def _currency(value: object) -> str | None:
        normalized = str(value or "").lower().replace("«", "").replace("»", "").strip()
        if normalized in {"руб.", "руб", "rub", "rur", "₽"}:
            return "RUB"
        if normalized in {"usd", "$"}:
            return "USD"
        if normalized in {"eur", "€"}:
            return "EUR"
        return None

    @staticmethod
    def _published(value: object) -> datetime | None:
        raw = str(value or "")
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed

    @staticmethod
    def _experience(item: dict) -> str | None:
        requirement = item.get("requirement") or {}
        raw = requirement.get("experience") if isinstance(requirement, dict) else None
        if not isinstance(raw, (str, int, float)):
            return None
        try:
            years = int(raw)
        except (TypeError, ValueError):
            return None
        if years <= 0:
            return "no_experience"
        if years <= 3:
            return "between1and3"
        if years <= 6:
            return "between3and6"
        return "morethan6"

    @staticmethod
    def _safe_raw(item: dict) -> dict:
        allowed = (
            "id",
            "job-name",
            "creation-date",
            "date_modify",
            "currency",
            "salary_min",
            "salary_max",
            "employment",
            "schedule",
            "skills",
            "source",
            "vac_url",
        )
        return {
            "provider": "trudvsem_open",
            **{key: item.get(key) for key in allowed if key in item},
            "region": item.get("region") or {},
            "requirement": item.get("requirement") or {},
        }

    @staticmethod
    def _title(raw: object) -> str:
        """Return a database-safe title while preserving the original in raw_payload."""
        source = str(raw or "").strip()
        # A small number of source records contain an accidentally pasted TSV row in
        # job-name.  Its first cell is still the actual vacancy title.
        first_cell = re.split(r"[\t\r\n]", source, maxsplit=1)[0]
        cleaned = re.sub(r"\s+", " ", first_cell).strip()
        if not cleaned:
            cleaned = re.sub(r"\s+", " ", source).strip()
        return cleaned[:500]

    def fetch(
        self, query: str, region_code: str, *, limit: int = 100, offset: int = 0
    ) -> Iterator[VacancyRecord]:
        page_limit = min(max(limit, 1), 100)
        endpoint = f"{self.base_url}/vacancies"
        if region_code not in {"", "ru"}:
            endpoint = f"{endpoint}/region/{region_code}"
        response = self.client.get(
            endpoint,
            params={"text": query, "limit": page_limit, "offset": max(offset, 0)},
        )
        response.raise_for_status()
        wrappers = ((response.json().get("results") or {}).get("vacancies") or [])
        for wrapper in wrappers:
            item = wrapper.get("vacancy") if isinstance(wrapper, dict) else None
            if not isinstance(item, dict) or not item.get("id") or not item.get("job-name"):
                continue
            published_at = self._published(item.get("creation-date"))
            if published_at is None:
                continue
            searchable = " ".join(
                str(item.get(key) or "")
                for key in ("schedule", "employment", "conditions", "qualification")
            ).lower()
            skills = tuple(dict.fromkeys(str(skill).strip() for skill in item.get("skills") or [] if skill))
            region = item.get("region") or {}
            yield VacancyRecord(
                external_id=str(item["id"]),
                title=self._title(item["job-name"]),
                region_code=str(region.get("region_code") or region_code),
                salary_from=self._positive_decimal(item.get("salary_min")),
                salary_to=self._positive_decimal(item.get("salary_max")),
                currency=self._currency(item.get("currency")),
                gross=None,
                published_at=published_at,
                experience=self._experience(item),
                is_remote=bool(re.search(r"удал[её]н|дистанцион", searchable)),
                skills=skills,
                raw=self._safe_raw(item),
            )
