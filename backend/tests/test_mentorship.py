from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import get_db
from app.main import app
from app.models import Base, MentorshipRequest
from app.providers.email import MentorshipEmail
from app.services.rate_limit import SupportRateLimiter, get_support_rate_limiter
from app.worker import deliver_mentorship_request

VALID_REQUEST = {
    "name": "Иван Петров",
    "contact": "applicant@example.com",
    "direction": "Backend",
    "level": "Junior",
    "proposed_budget_rub": 30000,
    "context": "Хочу системно подготовиться к поиску работы и техническим интервью.",
    "website": "",
}


@dataclass
class RecordingLimiter:
    calls: list[tuple[str, str]]

    def check(self, ip_hash: str, contact_hash: str) -> None:
        self.calls.append((ip_hash, contact_hash))


@pytest.fixture
def mentorship_api(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[
    tuple[TestClient, sessionmaker[Session], RecordingLimiter, list[int]], None, None
]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    limiter = RecordingLimiter(calls=[])
    queued: list[int] = []
    original_email_enabled = settings.support_email_enabled
    settings.support_email_enabled = False

    def override_db() -> Generator[Session, None, None]:
        with testing_session() as db:
            yield db

    def override_limiter() -> SupportRateLimiter:
        return limiter

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_support_rate_limiter] = override_limiter
    monkeypatch.setattr(deliver_mentorship_request, "delay", queued.append)
    try:
        with TestClient(app) as client:
            yield client, testing_session, limiter, queued
    finally:
        app.dependency_overrides.clear()
        settings.support_email_enabled = original_email_enabled
        engine.dispose()


def csrf_headers(client: TestClient) -> dict[str, str]:
    response = client.get("/api/v1/mentorship/csrf")
    assert response.status_code == 200
    token = response.json()["csrf_token"]
    assert client.cookies.get("techrole_mentorship_csrf") == token
    return {"X-CSRF-Token": token, "Origin": "http://localhost:3000"}


def test_mentorship_request_is_persisted_and_queued(
    mentorship_api: tuple[
        TestClient, sessionmaker[Session], RecordingLimiter, list[int]
    ],
) -> None:
    client, testing_session, limiter, queued = mentorship_api

    response = client.post(
        "/api/v1/mentorship/requests",
        json=VALID_REQUEST,
        headers=csrf_headers(client),
    )

    assert response.status_code == 202
    assert response.json()["status"] == "saved"
    with testing_session() as db:
        request = db.scalar(select(MentorshipRequest))
        assert request is not None
        assert request.public_id == response.json()["reference"]
        assert request.contact == "applicant@example.com"
        assert request.direction == "Backend"
        assert request.level == "Junior"
        assert request.proposed_budget_rub == 30000
        assert request.status == "pending"
        request_id = request.id
    assert queued == [request_id]
    assert len(limiter.calls) == 1


def test_mentorship_request_requires_csrf(
    mentorship_api: tuple[
        TestClient, sessionmaker[Session], RecordingLimiter, list[int]
    ],
) -> None:
    client, _, limiter, queued = mentorship_api
    response = client.post("/api/v1/mentorship/requests", json=VALID_REQUEST)
    assert response.status_code == 403
    assert limiter.calls == []
    assert queued == []


def test_mentorship_request_rejects_budget_outside_safe_range(
    mentorship_api: tuple[
        TestClient, sessionmaker[Session], RecordingLimiter, list[int]
    ],
) -> None:
    client, testing_session, limiter, queued = mentorship_api
    response = client.post(
        "/api/v1/mentorship/requests",
        json={**VALID_REQUEST, "proposed_budget_rub": 999},
        headers=csrf_headers(client),
    )

    assert response.status_code == 422
    with testing_session() as db:
        assert db.scalar(select(MentorshipRequest)) is None
    assert limiter.calls == []
    assert queued == []


def test_mentorship_request_requires_proposed_budget(
    mentorship_api: tuple[
        TestClient, sessionmaker[Session], RecordingLimiter, list[int]
    ],
) -> None:
    client, testing_session, limiter, queued = mentorship_api
    payload = {key: value for key, value in VALID_REQUEST.items() if key != "proposed_budget_rub"}
    response = client.post(
        "/api/v1/mentorship/requests",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 422
    with testing_session() as db:
        assert db.scalar(select(MentorshipRequest)) is None
    assert limiter.calls == []
    assert queued == []


def test_mentorship_delivery_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    testing_session = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    Base.metadata.create_all(engine)
    with testing_session() as db:
        request = MentorshipRequest(
            name="Анна",
            contact="anna@example.com",
            direction="Data / Analytics",
            level="Junior",
            proposed_budget_rub=25000,
            context="Хочу подготовиться к поиску первой позиции аналитика данных.",
            status="pending",
        )
        db.add(request)
        db.commit()
        request_id = request.id

    sent: list[MentorshipEmail] = []

    class RecordingEmailProvider:
        def send_mentorship(self, mentorship_email: MentorshipEmail) -> None:
            sent.append(mentorship_email)

    monkeypatch.setattr("app.database.SessionLocal", testing_session)
    monkeypatch.setattr(
        "app.providers.email.get_email_provider", lambda: RecordingEmailProvider()
    )

    first = deliver_mentorship_request.run(request_id)
    second = deliver_mentorship_request.run(request_id)

    assert first == {"status": "sent", "mentorship_id": request_id}
    assert second == {"status": "already_sent", "mentorship_id": request_id}
    assert len(sent) == 1
    assert sent[0].contact == "anna@example.com"
    assert sent[0].proposed_budget_rub == 25000
    engine.dispose()
