from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import get_db
from app.main import app
from app.models import Base, SupportRequest
from app.providers.email import (
    MentorshipEmail,
    PipelineReportEmail,
    SmtpEmailProvider,
    SupportEmail,
)
from app.services.rate_limit import (
    RateLimitExceeded,
    SupportRateLimiter,
    get_support_rate_limiter,
)
from app.worker import deliver_support_request

VALID_REQUEST = {
    "name": "Иван Петров",
    "email": "Applicant@Example.com",
    "topic": "account",
    "subject": "Не открывается личный кабинет",
    "message": "После входа личный кабинет не открывается. Помогите, пожалуйста.",
    "website": "",
}


@dataclass
class RecordingLimiter:
    calls: list[tuple[str, str]]
    reject: bool = False

    def check(self, ip_hash: str, email_hash: str) -> None:
        self.calls.append((ip_hash, email_hash))
        if self.reject:
            raise RateLimitExceeded


@pytest.fixture
def support_api(
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
    monkeypatch.setattr(deliver_support_request, "delay", queued.append)
    try:
        with TestClient(app) as client:
            yield client, testing_session, limiter, queued
    finally:
        app.dependency_overrides.clear()
        settings.support_email_enabled = original_email_enabled
        engine.dispose()


def csrf_headers(client: TestClient) -> dict[str, str]:
    response = client.get("/api/v1/support/csrf")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    token = response.json()["csrf_token"]
    assert client.cookies.get("techrole_support_csrf") == token
    return {"X-CSRF-Token": token, "Origin": "http://localhost:3000"}


def test_support_request_requires_matching_csrf_token(
    support_api: tuple[TestClient, sessionmaker[Session], RecordingLimiter, list[int]],
) -> None:
    client, _, limiter, queued = support_api

    missing = client.post("/api/v1/support/requests", json=VALID_REQUEST)
    assert missing.status_code == 403

    headers = csrf_headers(client)
    headers["X-CSRF-Token"] = "wrong-token"
    mismatch = client.post("/api/v1/support/requests", json=VALID_REQUEST, headers=headers)
    assert mismatch.status_code == 403
    assert limiter.calls == []
    assert queued == []


def test_support_request_is_persisted_and_queued_without_raw_ip(
    support_api: tuple[TestClient, sessionmaker[Session], RecordingLimiter, list[int]],
) -> None:
    client, testing_session, limiter, queued = support_api

    response = client.post(
        "/api/v1/support/requests",
        json=VALID_REQUEST,
        headers=csrf_headers(client),
    )

    assert response.status_code == 202
    assert response.json()["status"] == "saved"
    assert response.json()["email_sent"] is False
    with testing_session() as db:
        support_request = db.scalar(select(SupportRequest))
        assert support_request is not None
        assert support_request.public_id == response.json()["reference"]
        assert support_request.email == "applicant@example.com"
        assert support_request.name == VALID_REQUEST["name"]
        assert support_request.status == "pending"
        assert support_request.ip_hash is not None
        assert len(support_request.ip_hash) == 64
        assert "testclient" not in support_request.ip_hash
        support_id = support_request.id
    assert queued == [support_id]
    assert len(limiter.calls) == 1
    assert all(len(identifier) == 64 for identifier in limiter.calls[0])


def test_support_rate_limit_rejection_returns_429_without_persisting(
    support_api: tuple[TestClient, sessionmaker[Session], RecordingLimiter, list[int]],
) -> None:
    client, testing_session, limiter, queued = support_api
    limiter.reject = True

    response = client.post(
        "/api/v1/support/requests",
        json=VALID_REQUEST,
        headers=csrf_headers(client),
    )

    assert response.status_code == 429
    with testing_session() as db:
        assert db.scalar(select(func.count()).select_from(SupportRequest)) == 0
    assert len(limiter.calls) == 1
    assert queued == []


def test_support_honeypot_is_accepted_without_storage_or_queue(
    support_api: tuple[TestClient, sessionmaker[Session], RecordingLimiter, list[int]],
) -> None:
    client, testing_session, limiter, queued = support_api
    payload = {**VALID_REQUEST, "website": "https://spam.invalid"}

    response = client.post(
        "/api/v1/support/requests", json=payload, headers=csrf_headers(client)
    )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"
    with testing_session() as db:
        assert db.scalar(select(func.count()).select_from(SupportRequest)) == 0
    assert limiter.calls == []
    assert queued == []


def test_support_delivery_is_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    with testing_session() as db:
        support_request = SupportRequest(
            name="Анна",
            email="anna@example.com",
            topic="site",
            subject="Ошибка на странице",
            message="На странице профессии не загружается график зарплаты.",
            status="pending",
            ip_hash="0" * 64,
        )
        db.add(support_request)
        db.commit()
        support_id = support_request.id

    sent: list[SupportEmail] = []

    class RecordingEmailProvider:
        def send_support(self, support_email: SupportEmail) -> None:
            sent.append(support_email)

    monkeypatch.setattr("app.database.SessionLocal", testing_session)
    monkeypatch.setattr(
        "app.providers.email.get_email_provider", lambda: RecordingEmailProvider()
    )

    first = deliver_support_request.run(support_id)
    second = deliver_support_request.run(support_id)

    assert first == {"status": "sent", "support_id": support_id}
    assert second == {"status": "already_sent", "support_id": support_id}
    assert len(sent) == 1
    assert sent[0].reply_to == "anna@example.com"
    with testing_session() as db:
        stored = db.get(SupportRequest, support_id)
        assert stored is not None
        assert stored.status == "sent"
        assert stored.delivery_attempts == 1
        assert stored.delivered_at is not None
        assert stored.last_error is None
    engine.dispose()


def test_processing_support_delivery_is_not_sent_twice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    with testing_session() as db:
        support_request = SupportRequest(
            name="Анна",
            email="anna@example.com",
            topic="site",
            subject="Ошибка на странице",
            message="На странице профессии не загружается график зарплаты.",
            status="processing",
        )
        db.add(support_request)
        db.commit()
        support_id = support_request.id

    def must_not_create_provider() -> Any:
        raise AssertionError("A processing request must not be sent again")

    monkeypatch.setattr("app.database.SessionLocal", testing_session)
    monkeypatch.setattr("app.providers.email.get_email_provider", must_not_create_provider)

    assert deliver_support_request.run(support_id) == {
        "status": "already_processing",
        "support_id": support_id,
    }
    engine.dispose()


def test_smtp_provider_sends_to_configured_recipient_with_safe_reply_to(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connections: list[dict[str, Any]] = []

    class FakeSmtp:
        def __init__(self, host: str, port: int, **kwargs: Any) -> None:
            self.connection = {"host": host, "port": port, **kwargs}
            connections.append(self.connection)

        def __enter__(self) -> FakeSmtp:
            return self

        def __exit__(self, *args: Any) -> None:
            return None

        def login(self, username: str, password: str) -> None:
            self.connection["login"] = (username, password)

        def send_message(self, message: EmailMessage) -> None:
            self.connection["message"] = message

    monkeypatch.setattr("app.providers.email.smtplib.SMTP_SSL", FakeSmtp)
    provider = SmtpEmailProvider(
        host="smtp.yandex.ru",
        port=465,
        username="support-owner@yandex.com",
        password="application-password",
        from_email="support-owner@yandex.com",
        recipient_email="sqldevelopermoscow@yandex.com",
        use_ssl=True,
        timeout=15,
    )

    provider.send_support(
        SupportEmail(
            public_id="request-1",
            name="Анна",
            reply_to="anna@example.com",
            topic="site",
            subject="Ошибка на странице",
            message="На странице профессии не загружается график зарплаты.",
        )
    )

    assert len(connections) == 1
    assert connections[0]["host"] == "smtp.yandex.ru"
    assert connections[0]["port"] == 465
    assert connections[0]["timeout"] == 15
    assert connections[0]["login"] == (
        "support-owner@yandex.com",
        "application-password",
    )
    message = connections[0]["message"]
    assert isinstance(message, EmailMessage)
    assert message["To"] == "sqldevelopermoscow@yandex.com"
    assert message["From"] == "support-owner@yandex.com"
    assert message["Reply-To"] == "anna@example.com"
    assert message["Subject"] == "[TechRole Support] Ошибка на странице"
    assert "request-1" in message.get_content()

    provider.send_mentorship(
        MentorshipEmail(
            public_id="mentorship-1",
            name="Анна",
            contact="anna@example.com",
            direction="Backend",
            level="Junior",
            proposed_budget_rub=30000,
            context="Хочу подготовиться к поиску первой работы в разработке.",
        )
    )

    assert len(connections) == 2
    mentorship_message = connections[1]["message"]
    assert isinstance(mentorship_message, EmailMessage)
    assert mentorship_message["To"] == "sqldevelopermoscow@yandex.com"
    assert mentorship_message["Reply-To"] == "anna@example.com"
    assert mentorship_message["Subject"] == "[TechRole Mentorship] Новая заявка: Анна"
    assert "mentorship-1" in mentorship_message.get_content()
    assert "30 000" in mentorship_message.get_content()

    provider.send_pipeline_report(
        PipelineReportEmail(
            status="success",
            started_at="2026-07-18T00:00:00+03:00",
            finished_at="2026-07-18T00:05:00+03:00",
            summary='{"records_seen": 100}',
        )
    )
    assert len(connections) == 3
    report_message = connections[2]["message"]
    assert isinstance(report_message, EmailMessage)
    assert report_message["Subject"] == "[TechRole Nightly] Успех: сбор данных"
    assert "records_seen" in report_message.get_content()
