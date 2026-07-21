from datetime import timezone
from decimal import Decimal

import httpx
import pytest

from app.config import Settings
from app.providers.vacancies import TrudvsemOpenDataProvider


def test_trudvsem_provider_uses_official_json_and_drops_contact_data() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/vacancies"
        assert request.url.params["text"] == "Python разработчик"
        assert request.url.params["limit"] == "1"
        assert request.url.params["offset"] == "2"
        return httpx.Response(
            200,
            json={
                "status": 200,
                "meta": {"total": 1, "limit": 1},
                "results": {
                    "vacancies": [
                        {
                            "vacancy": {
                                "id": "open-1",
                                "job-name": "Middle Python разработчик\tлишние поля\nещё строка",
                                "creation-date": "2026-07-18",
                                "date_modify": "2026-07-18T10:00:00+03:00",
                                "salary_min": 150000,
                                "salary_max": 0,
                                "currency": "«руб.»",
                                "schedule": "Удаленная работа",
                                "employment": "Полная занятость",
                                "skills": ["Python", "SQL", "Python"],
                                "region": {"name": "Москва", "region_code": "7700000000000"},
                                "requirement": {"experience": 2},
                                "contact_person": "must not be stored",
                                "contact_list": [{"contact_type": "Телефон"}],
                            }
                        }
                    ]
                },
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = TrudvsemOpenDataProvider(
        Settings(trudvsem_enabled=True),
        client=client,
    )

    rows = list(provider.fetch("Python разработчик", "ru", limit=1, offset=2))

    assert len(rows) == 1
    row = rows[0]
    assert row.external_id == "open-1"
    assert row.title == "Middle Python разработчик"
    assert row.raw["job-name"] == "Middle Python разработчик\tлишние поля\nещё строка"
    assert row.salary_from == Decimal("150000")
    assert row.salary_to is None
    assert row.currency == "RUB"
    assert row.gross is None
    assert row.experience == "between1and3"
    assert row.is_remote is True
    assert row.skills == ("Python", "SQL")
    assert row.published_at.tzinfo == timezone.utc
    assert "contact_person" not in row.raw
    assert "contact_list" not in row.raw


def test_trudvsem_provider_is_disabled_by_default() -> None:
    with pytest.raises(RuntimeError, match="disabled"):
        TrudvsemOpenDataProvider(Settings(trudvsem_enabled=False))
