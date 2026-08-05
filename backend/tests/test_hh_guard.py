from urllib.parse import parse_qs

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.providers.vacancies import HhApiProvider


def test_hh_provider_is_disabled_by_default():
    with pytest.raises(RuntimeError, match="disabled"):
        HhApiProvider(Settings(hh_enabled=False))


def test_hh_requires_commercial_confirmation_and_contact():
    with pytest.raises(ValidationError, match="HH_ENABLED requires"):
        Settings(hh_enabled=True, hh_commercial_use_confirmed=False)
    with pytest.raises(ValidationError, match="HH_ENABLED requires"):
        Settings(
            hh_enabled=True,
            hh_commercial_use_confirmed=True,
            hh_contact_email="",
        )


def test_hh_requires_application_token():
    with pytest.raises(ValidationError, match="either HH_ACCESS_TOKEN"):
        Settings(
            hh_enabled=True,
            hh_commercial_use_confirmed=True,
            hh_contact_email="owner@example.com",
            hh_app_name="TechRoleIndex",
            hh_access_token="",
        )


def test_hh_requires_complete_client_credentials_pair():
    with pytest.raises(ValidationError, match="must be configured together"):
        Settings(hh_client_id="client-id", hh_client_secret="")


def test_hh_provider_can_renew_application_token_server_side():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.url.path == "/token":
            return httpx.Response(200, json={"access_token": "renewed-token"})
        return httpx.Response(200, json={"pages": 0, "items": []})

    settings = Settings(
        hh_enabled=True,
        hh_commercial_use_confirmed=True,
        hh_contact_email="owner@example.com",
        hh_app_name="TechRoleIndex",
        hh_client_id="client-id",
        hh_client_secret="client-secret",
    )
    client = httpx.Client(transport=httpx.MockTransport(handler))

    assert list(HhApiProvider(settings, client=client).fetch("Python", "ru")) == []
    assert [request.url.path for request in captured] == ["/token", "/vacancies"]
    token_form = parse_qs(captured[0].content.decode())
    assert token_form == {
        "grant_type": ["client_credentials"],
        "client_id": ["client-id"],
        "client_secret": ["client-secret"],
    }
    assert captured[1].headers["authorization"] == "Bearer renewed-token"


def test_hh_provider_retries_once_when_application_token_expires():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.url.path == "/token":
            return httpx.Response(200, json={"access_token": "renewed-token"})
        if request.headers.get("authorization") == "Bearer expired-token":
            return httpx.Response(
                403,
                json={"errors": [{"type": "oauth", "value": "token_expired"}]},
            )
        return httpx.Response(200, json={"pages": 0, "items": []})

    settings = Settings(
        hh_enabled=True,
        hh_commercial_use_confirmed=True,
        hh_contact_email="owner@example.com",
        hh_app_name="TechRoleIndex",
        hh_access_token="expired-token",
        hh_client_id="client-id",
        hh_client_secret="client-secret",
    )
    client = httpx.Client(transport=httpx.MockTransport(handler))

    assert list(HhApiProvider(settings, client=client).fetch("Python", "ru")) == []
    assert [request.url.path for request in captured] == [
        "/vacancies",
        "/token",
        "/vacancies",
    ]
    assert captured[-1].headers["authorization"] == "Bearer renewed-token"


def test_hh_provider_uses_application_auth_and_minimizes_raw_payload():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "pages": 1,
                "items": [
                    {
                        "id": "hh-1",
                        "name": "Middle Python разработчик",
                        "published_at": "2026-08-04T12:00:00+0300",
                        "area": {"id": "1", "name": "Москва"},
                        "salary": {
                            "from": 180000,
                            "to": 250000,
                            "currency": "RUR",
                            "gross": True,
                        },
                        "experience": {"id": "between1And3"},
                        "work_format": [{"id": "REMOTE"}],
                        "professional_roles": [{"id": "96", "name": "Программист"}],
                        "employer": {"id": "private", "name": "Not persisted"},
                        "snippet": {"requirement": "Not persisted"},
                    }
                ],
            },
        )

    settings = Settings(
        hh_enabled=True,
        hh_commercial_use_confirmed=True,
        hh_contact_email="owner@example.com",
        hh_app_name="TechRoleIndex",
        hh_access_token="secret-token",
    )
    client = httpx.Client(transport=httpx.MockTransport(handler))
    rows = list(HhApiProvider(settings, client=client).fetch("Python", "ru"))

    assert len(rows) == 1
    assert rows[0].currency == "RUB"
    assert rows[0].gross is True
    assert rows[0].is_remote is True
    assert rows[0].raw["provider"] == "hh_api"
    assert "employer" not in rows[0].raw
    assert "snippet" not in rows[0].raw
    assert captured[0].headers["authorization"] == "Bearer secret-token"
    assert captured[0].headers["hh-user-agent"].startswith("TechRoleIndex/0.1")
    assert captured[0].url.params["area"] == "113"
    assert captured[0].url.params["page"] == "0"
    assert captured[0].url.params["date_from"]
