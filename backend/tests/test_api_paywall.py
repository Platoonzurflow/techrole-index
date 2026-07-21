from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api import professions as professions_api
from app.config import settings
from app.database import get_db
from app.domain.scoring import DEFAULT_WEIGHTS
from app.main import app
from app.models import (
    Base,
    Entitlement,
    PaymentEvent,
    PaymentOrder,
    PaymentRefund,
    Profession,
    ProfessionCategory,
    ProfessionMetricDaily,
    ProfessionScoreDaily,
    Region,
    ScoringVersion,
    SeniorityLevel,
    User,
    Vacancy,
    VacancySource,
)
from app.providers.payments import DemoPaymentProvider
from app.security import hash_password
from app.services.cache import RedisJsonCache
from app.services.rate_limit import get_auth_rate_limiter


class NoopAuthRateLimiter:
    def check(self, ip_hash: str) -> None:
        del ip_hash


def build_client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session = Session(engine)
    category = ProfessionCategory(slug="development", name_ru="Разработка", description="Тест")
    region = Region(code="ru", name_ru="Россия")
    levels = [
        SeniorityLevel(code=code, name_ru=code.title(), sort_order=index)
        for index, code in enumerate(("junior", "middle", "senior"), 1)
    ]
    version = ScoringVersion(
        version="test-v1",
        weights=DEFAULT_WEIGHTS,
        description="Тестовая версия с полным описанием",
        is_active=True,
    )
    users = [
        User(
            email="free@example.com",
            display_name="Free",
            password_hash=hash_password("FreePassword1!"),
        ),
        User(
            email="premium@example.com",
            display_name="Premium",
            password_hash=hash_password("PremiumPassword1!"),
        ),
        User(
            email="admin@example.com",
            display_name="Admin",
            password_hash=hash_password("AdminPassword1!"),
            role="admin",
        ),
    ]
    session.add_all([category, region, version, *levels, *users])
    session.flush()
    professions = []
    for index in range(4):
        item = Profession(
            slug=f"role-{index}",
            name_ru=f"Роль {index}",
            name_en=f"Role {index}",
            description=f"Уникальное описание профессии номер {index}",
            category_id=category.id,
            is_premium=index == 0,
        )
        session.add(item)
        session.flush()
        professions.append(item)
        session.add(
            ProfessionScoreDaily(
                score_date=date(2026, 7, 17),
                profession_id=item.id,
                scoring_version_id=version.id,
                score=Decimal(str(90 - index)),
                breakdown={"demand": 50},
                data_confidence="medium",
            )
        )
        for day in range(40):
            for level in levels:
                session.add(
                    ProfessionMetricDaily(
                        metric_date=date(2026, 7, 17) - timedelta(days=39 - day),
                        profession_id=item.id,
                        seniority_id=level.id,
                        region_id=region.id,
                        gross=True,
                        vacancy_count=30,
                        salary_count=20,
                        salary_coverage=Decimal("0.66667"),
                        salary_median=Decimal("200000"),
                        salary_average=Decimal("205000"),
                        salary_p25=Decimal("170000"),
                        salary_p75=Decimal("240000"),
                        lower_bound_median=Decimal("180000"),
                        upper_bound_median=Decimal("220000"),
                        sample_size=20,
                        confidence_level="medium",
                        remote_share=Decimal("0.4"),
                    )
                )
    source = VacancySource(
        code="trudvsem_open",
        name="Работа России",
        provider_type="official_open_api",
        enabled=True,
        terms_url="https://trudvsem.ru/opendata/api",
    )
    session.add(source)
    session.flush()
    observed_at = datetime.now(timezone.utc) - timedelta(days=2)
    for index in range(20):
        session.add(
            Vacancy(
                source_id=source.id,
                external_id=f"official-{index}",
                title="Junior тестовая вакансия",
                region_id=region.id,
                currency="RUB",
                salary_gross=None,
                salary_from=Decimal("100000"),
                salary_to=Decimal("200000"),
                published_at=observed_at,
                first_seen_at=observed_at,
                last_seen_at=observed_at,
                work_format="remote",
                is_remote=True,
                profession_id=professions[0].id,
                seniority_id=levels[0].id,
                classification_confidence=Decimal("0.95"),
                classifier_version="rules-v1",
                raw_payload={"provider": "test"},
            )
        )
    session.add(
        Entitlement(
            user_id=users[1].id,
            code="premium",
            source="test",
            starts_at=datetime.now(timezone.utc) - timedelta(days=1),
            ends_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
    )
    session.commit()

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_auth_rate_limiter] = NoopAuthRateLimiter
    return TestClient(app), session


def test_free_response_does_not_contain_premium_fields():
    client, session = build_client()
    login = client.post(
        "/api/v1/auth/login", json={"email": "free@example.com", "password": "FreePassword1!"}
    )
    assert login.status_code == 200
    response = client.get("/api/v1/professions/role-0?days=180")
    assert response.status_code == 200
    payload = response.json()
    for forbidden in (
        "metrics",
        "score",
        "score_breakdown",
        "vacancy_trends",
        "salary_trends",
        "history_days",
    ):
        assert forbidden not in payload
    assert payload["teaser_only"] is True
    assert payload["official_open_data"]["salary_gross_status"] == "unknown"
    assert payload["salary_benchmark"]["coverage"] == "category"
    assert len(payload["salary_benchmark"]["points"]) == 4
    assert payload["salary_benchmark"]["sources"][0]["tax_status"] == "net"
    official_junior = payload["official_open_data"]["salary_by_seniority"][0]
    assert official_junior["median"] == 150000
    assert official_junior["sample_size"] == 20
    catalog = client.get("/api/v1/open-data/publications").json()
    assert catalog[0]["salary_by_seniority"][0]["median"] == 150000
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_legacy_demo_login_migrates_to_valid_email():
    client, session = build_client()
    user = session.scalar(select(User).where(User.email == "free@example.com"))
    assert user is not None
    user.email = "free@demo.local"
    session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "free@example.com"
    assert session.scalar(select(User).where(User.email == "free@example.com")) is not None
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_free_history_is_capped_and_ranking_is_teaser():
    client, session = build_client()
    client.post(
        "/api/v1/auth/login", json={"email": "free@example.com", "password": "FreePassword1!"}
    )
    detail = client.get("/api/v1/professions/role-1?days=180").json()
    assert detail["history_days"] == 30
    assert len(detail["metrics"]) == 90
    ranking = client.get("/api/v1/ranking").json()
    assert len(ranking) == 3
    assert ranking[0]["weekly_change_percent"] == 0
    assert ranking[0]["weekly_direction"] == "neutral"
    assert client.get("/api/v1/export/professions/role-1.csv").status_code == 403
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_premium_receives_full_history_and_compare():
    client, session = build_client()
    client.post(
        "/api/v1/auth/login", json={"email": "premium@example.com", "password": "PremiumPassword1!"}
    )
    detail = client.get("/api/v1/professions/role-0?days=180").json()
    assert detail["teaser_only"] is False
    assert detail["history_days"] == 180
    assert len(detail["metrics"]) == 120
    response = client.get("/api/v1/compare?slugs=role-0,role-1")
    assert response.status_code == 200
    export = client.get("/api/v1/export/professions/role-0.csv")
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    csrf = client.cookies.get("techrole_csrf")
    created = client.post(
        "/api/v1/alerts",
        headers={"X-CSRF-Token": csrf},
        json={
            "profession_id": 1,
            "metric": "demand",
            "direction": "up",
            "threshold_percent": 5,
        },
    )
    assert created.status_code == 201
    assert len(client.get("/api/v1/alerts").json()) == 1
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_detail_cache_keeps_public_and_premium_contracts_isolated(monkeypatch):
    class MemoryClient:
        def __init__(self):
            self.values = {}

        def get(self, name):
            return self.values.get(name)

        def set(self, name, value, *, ex):
            del ex
            self.values[name] = value
            return True

    memory = MemoryClient()
    monkeypatch.setattr(
        professions_api,
        "profession_cache",
        RedisJsonCache(
            enabled=True,
            redis_url="redis://unused",
            ttl_seconds=120,
            client=memory,
        ),
    )
    client, session = build_client()

    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    public_first = client.get("/api/v1/professions/role-0?days=180").json()
    assert public_first["teaser_only"] is True
    assert "metrics" not in public_first

    client.post(
        "/api/v1/auth/login",
        json={"email": "premium@example.com", "password": "PremiumPassword1!"},
    )
    premium = client.get("/api/v1/professions/role-0?days=180").json()
    assert premium["teaser_only"] is False
    assert len(premium["metrics"]) == 120

    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    public_cached = client.get("/api/v1/professions/role-0?days=180").json()
    assert public_cached["teaser_only"] is True
    assert "metrics" not in public_cached
    assert len(memory.values) == 2

    client.close()
    session.close()
    app.dependency_overrides.clear()


def enable_demo_payments(monkeypatch):
    monkeypatch.setattr(settings, "payments_enabled", True)
    monkeypatch.setattr(settings, "payments_provider", "demo")
    monkeypatch.setattr(settings, "payments_mode", "test")
    monkeypatch.setattr(settings, "premium_30_days_price_rub", Decimal("1.00"))
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "payments_terms_version", "draft-test")


def create_demo_order(client):
    return client.post(
        "/api/v1/payments",
        headers={
            "X-CSRF-Token": client.cookies.get("techrole_csrf"),
            "Idempotency-Key": "checkout-key-0001",
        },
        json={
            "product_code": "premium_30_days",
            "accepted_terms": True,
            "terms_version": "draft-test",
        },
    )


def signed_payment_webhook(provider, order, *, event_id, status, amount="1.00"):
    return provider.sign_webhook(
        {
            "event_id": event_id,
            "event": f"payment.{status}",
            "object": {
                "id": order.external_payment_id,
                "status": status,
                "amount": {"value": amount, "currency": "RUB"},
                "metadata": {"order_id": order.public_id},
                "test": True,
            },
        }
    )


def test_demo_checkout_is_server_priced_and_idempotent(monkeypatch):
    enable_demo_payments(monkeypatch)
    client, session = build_client()
    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    rejected_terms = client.post(
        "/api/v1/payments",
        headers={
            "X-CSRF-Token": client.cookies.get("techrole_csrf"),
            "Idempotency-Key": "checkout-terms-0001",
        },
        json={
            "product_code": "premium_30_days",
            "accepted_terms": True,
            "terms_version": "stale-version",
        },
    )
    assert rejected_terms.status_code == 422
    purchase = create_demo_order(client)
    assert purchase.status_code == 200
    assert purchase.json()["amount"] == "1.00"
    assert purchase.json()["status"] == "pending"
    assert purchase.json()["is_test"] is True
    assert client.get("/api/v1/auth/me").json()["access_level"] == "free"

    duplicate = create_demo_order(client)
    assert duplicate.status_code == 200
    assert duplicate.json()["order_id"] == purchase.json()["order_id"]
    assert len(session.scalars(select(PaymentOrder).where(PaymentOrder.user_id == 1)).all()) == 1

    tampered = client.post(
        "/api/v1/payments",
        headers={
            "X-CSRF-Token": client.cookies.get("techrole_csrf"),
            "Idempotency-Key": "checkout-key-0002",
        },
        json={
            "product_code": "premium_30_days",
            "accepted_terms": True,
            "terms_version": "draft-test",
            "amount": "0.01",
        },
    )
    assert tampered.status_code == 422

    completed = client.post(
        f"/api/v1/payments/{purchase.json()['order_id']}/demo/complete",
        headers={"X-CSRF-Token": client.cookies.get("techrole_csrf")},
        json={"outcome": "succeeded"},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "succeeded"
    assert client.get("/api/v1/auth/me").json()["access_level"] == "premium"
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_demo_webhook_rejects_bad_signature_amount_and_replays(monkeypatch):
    enable_demo_payments(monkeypatch)
    client, session = build_client()
    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    purchase = create_demo_order(client)
    order = session.scalar(
        select(PaymentOrder).where(PaymentOrder.public_id == purchase.json()["order_id"])
    )
    assert order is not None

    provider = DemoPaymentProvider(settings.app_secret_key, settings.public_base_url)
    body, signature = signed_payment_webhook(
        provider, order, event_id="evt-idempotent-1", status="succeeded"
    )
    assert (
        client.post(
            "/api/v1/payments/webhooks/demo",
            content=body,
            headers={"X-Demo-Signature": "0" * 64, "Content-Type": "application/json"},
        ).status_code
        == 401
    )

    wrong_body, wrong_signature = signed_payment_webhook(
        provider,
        order,
        event_id="evt-wrong-amount",
        status="succeeded",
        amount="0.01",
    )
    assert (
        client.post(
            "/api/v1/payments/webhooks/demo",
            content=wrong_body,
            headers={
                "X-Demo-Signature": wrong_signature,
                "Content-Type": "application/json",
            },
        ).status_code
        == 422
    )
    assert client.get("/api/v1/auth/me").json()["access_level"] == "free"

    headers = {"X-Demo-Signature": signature, "Content-Type": "application/json"}
    assert (
        client.post("/api/v1/payments/webhooks/demo", content=body, headers=headers).json()[
            "status"
        ]
        == "processed"
    )
    assert (
        client.post("/api/v1/payments/webhooks/demo", content=body, headers=headers).json()[
            "status"
        ]
        == "already_processed"
    )
    assert client.get("/api/v1/auth/me").json()["access_level"] == "premium"
    assert len(session.scalars(select(PaymentEvent)).all()) == 2
    assert (
        len(
            session.scalars(
                select(Entitlement).where(Entitlement.source == f"payment:{order.public_id}")
            ).all()
        )
        == 1
    )
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_canceled_demo_payment_does_not_grant_access(monkeypatch):
    enable_demo_payments(monkeypatch)
    client, session = build_client()
    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    purchase = create_demo_order(client)
    response = client.post(
        f"/api/v1/payments/{purchase.json()['order_id']}/demo/complete",
        headers={"X-CSRF-Token": client.cookies.get("techrole_csrf")},
        json={"outcome": "canceled"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "canceled"
    replay_as_success = client.post(
        f"/api/v1/payments/{purchase.json()['order_id']}/demo/complete",
        headers={"X-CSRF-Token": client.cookies.get("techrole_csrf")},
        json={"outcome": "succeeded"},
    )
    assert replay_as_success.status_code == 200
    assert replay_as_success.json()["status"] == "canceled"
    assert client.get("/api/v1/auth/me").json()["access_level"] == "free"
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_admin_full_refund_is_idempotent_and_revokes_payment_access(monkeypatch):
    enable_demo_payments(monkeypatch)
    client, session = build_client()
    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    purchase = create_demo_order(client)
    client.post(
        f"/api/v1/payments/{purchase.json()['order_id']}/demo/complete",
        headers={"X-CSRF-Token": client.cookies.get("techrole_csrf")},
        json={"outcome": "succeeded"},
    )
    assert client.get("/api/v1/auth/me").json()["access_level"] == "premium"

    forbidden = client.post(
        f"/api/v1/payments/{purchase.json()['order_id']}/refund",
        headers={
            "X-CSRF-Token": client.cookies.get("techrole_csrf"),
            "Idempotency-Key": "refund-forbidden-0001",
        },
        json={"reason": "customer_request"},
    )
    assert forbidden.status_code == 403

    client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "AdminPassword1!"},
    )
    headers = {
        "X-CSRF-Token": client.cookies.get("techrole_csrf"),
        "Idempotency-Key": "refund-key-0001",
    }
    refunded = client.post(
        f"/api/v1/payments/{purchase.json()['order_id']}/refund",
        headers=headers,
        json={"reason": "customer_request"},
    )
    assert refunded.status_code == 200
    assert refunded.json()["status"] == "succeeded"
    repeated = client.post(
        f"/api/v1/payments/{purchase.json()['order_id']}/refund",
        headers=headers,
        json={"reason": "customer_request"},
    )
    assert repeated.status_code == 200
    assert repeated.json()["refund_id"] == refunded.json()["refund_id"]
    assert len(session.scalars(select(PaymentRefund)).all()) == 1

    order = session.scalar(
        select(PaymentOrder).where(PaymentOrder.public_id == purchase.json()["order_id"])
    )
    local_refund = session.scalar(select(PaymentRefund))
    assert order is not None and local_refund is not None
    provider = DemoPaymentProvider(settings.app_secret_key, settings.public_base_url)
    refund_body, refund_signature = provider.sign_webhook(
        {
            "event_id": "evt-refund-replay-1",
            "event": "refund.succeeded",
            "object": {
                "id": local_refund.external_refund_id,
                "payment_id": order.external_payment_id,
                "status": "succeeded",
                "amount": {"value": "1.00", "currency": "RUB"},
            },
        }
    )
    webhook_headers = {
        "X-Demo-Signature": refund_signature,
        "Content-Type": "application/json",
    }
    assert (
        client.post(
            "/api/v1/payments/webhooks/demo",
            content=refund_body,
            headers=webhook_headers,
        ).json()["status"]
        == "processed"
    )
    assert (
        client.post(
            "/api/v1/payments/webhooks/demo",
            content=refund_body,
            headers=webhook_headers,
        ).json()["status"]
        == "already_processed"
    )

    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    assert client.get("/api/v1/auth/me").json()["access_level"] == "free"
    client.close()
    session.close()
    app.dependency_overrides.clear()
