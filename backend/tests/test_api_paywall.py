import hashlib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import urlencode

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
    AnalyticsEvent,
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
        "score_weights",
        "score_contributions",
        "vacancy_trends",
        "salary_trends",
        "history_days",
    ):
        assert forbidden not in payload
    assert payload["teaser_only"] is True
    assert payload["official_open_data"]["salary_gross_status"] == "unknown"
    assert payload["official_open_data"]["salary_history_reference_median"] == 223000
    assert payload["official_open_data"]["salary_history_reference_scope"] == "category"
    assert payload["official_open_data"]["salary_history_minimum_ratio"] == {
        "junior": 0.4,
        "middle": 0.7,
        "senior": 1.0,
    }
    assert payload["official_open_data"]["salary_history_minimum_salary"] == {
        "junior": 89200,
        "middle": 156100,
        "senior": 223000,
    }
    assert payload["official_open_data"]["category_total_publications"] >= 20
    assert sum(
        point["count"]
        for point in payload["official_open_data"]["category_daily_publications"]
    ) == payload["official_open_data"]["category_total_publications"]
    assert payload["official_open_data"]["category_salary_disclosed_count"] == 20
    assert sum(
        point["count"]
        for point in payload["official_open_data"]["daily_complete_salary_ranges"]
    ) == payload["official_open_data"]["complete_salary_range_count"]
    assert sum(
        point["count"]
        for point in payload["official_open_data"]["category_daily_complete_salary_ranges"]
    ) == payload["official_open_data"]["category_complete_salary_range_count"]
    assert payload["official_open_data"]["category_remote_count"] == 20
    assert payload["official_open_data"]["category_confidence_level"] == "medium"
    category_junior = payload["official_open_data"]["category_salary_by_seniority"][0]
    assert category_junior["median"] == 150000
    assert category_junior["sample_size"] == 20
    assert payload["salary_benchmark"]["coverage"] == "category"
    assert len(payload["salary_benchmark"]["points"]) == 8
    assert any(
        point["scope"] == "occupation_group"
        and point["source_id"] == "rosstat_57t_2025"
        and point["metric"] == "average"
        for point in payload["salary_benchmark"]["points"]
    )
    assert {
        point["seniority"]
        for point in payload["salary_benchmark"]["points"]
        if point.get("seniority")
    } == {"junior", "middle", "senior"}
    assert {source["tax_status"] for source in payload["salary_benchmark"]["sources"]} == {
        "gross",
        "net",
        "unknown",
    }
    official_junior = payload["official_open_data"]["salary_by_seniority"][0]
    assert official_junior["median"] == 150000
    assert official_junior["sample_size"] == 20
    junior_history = [
        point
        for point in payload["official_open_data"]["salary_history"]
        if point["seniority"] == "junior" and point.get("median") is not None
    ]
    assert junior_history[-1]["sample_size"] == 20
    assert junior_history[-1]["scope"] == "profession"

    category_fallback = client.get("/api/v1/professions/role-1?days=180").json()
    fallback_history = [
        point
        for point in category_fallback["official_open_data"]["salary_history"]
        if point["seniority"] == "junior" and point.get("median") is not None
    ]
    assert fallback_history[-1]["median"] == 150000
    assert fallback_history[-1]["scope"] == "category"
    catalog = client.get("/api/v1/open-data/publications").json()
    assert catalog[0]["category_slug"] == "development"
    assert catalog[0]["salary_by_seniority"][0]["median"] == 150000
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_salary_history_filters_low_midpoints_without_changing_raw_counts():
    client, session = build_client()
    source = session.scalar(
        select(VacancySource).where(VacancySource.code == "trudvsem_open")
    )
    profession = session.scalar(select(Profession).where(Profession.slug == "role-0"))
    region = session.scalar(select(Region).where(Region.code == "ru"))
    levels = {
        item.code: item
        for item in session.scalars(select(SeniorityLevel)).all()
    }
    assert source and profession and region
    observed_at = datetime.now(timezone.utc) - timedelta(days=1)
    observations = [
        ("junior", 5, "30000", "50000"),
        ("middle", 3, "140000", "150000"),
        ("middle", 3, "160000", "180000"),
        ("senior", 3, "200000", "220000"),
        ("senior", 3, "230000", "250000"),
    ]
    external_index = 0
    for seniority, count, salary_from, salary_to in observations:
        for _ in range(count):
            session.add(
                Vacancy(
                    source_id=source.id,
                    external_id=f"reference-filter-{external_index}",
                    title=f"{seniority.title()} тестовая вакансия",
                    region_id=region.id,
                    currency="RUB",
                    salary_gross=None,
                    salary_from=Decimal(salary_from),
                    salary_to=Decimal(salary_to),
                    published_at=observed_at,
                    first_seen_at=observed_at,
                    last_seen_at=observed_at,
                    work_format="office",
                    is_remote=False,
                    profession_id=profession.id,
                    seniority_id=levels[seniority].id,
                    classification_confidence=Decimal("0.95"),
                    classifier_version="rules-v1",
                    raw_payload={"provider": "test"},
                )
            )
            external_index += 1
    session.commit()

    response = client.get("/api/v1/professions/role-0?days=180")
    assert response.status_code == 200
    official = response.json()["official_open_data"]
    assert official["total_publications"] == 37
    assert official["complete_salary_range_count"] == 37
    expected_history = {
        "junior": (150000, 20),
        "middle": (170000, 3),
        "senior": (240000, 3),
    }
    for seniority, (expected_median, expected_sample) in expected_history.items():
        points = [
            point
            for point in official["salary_history"]
            if point["seniority"] == seniority and point.get("median") is not None
        ]
        assert points[-1]["median"] == expected_median
        assert points[-1]["sample_size"] == expected_sample

    raw_slices = {
        item["seniority"]: item for item in official["salary_by_seniority"]
    }
    assert raw_slices["middle"]["median"] == 157500
    assert raw_slices["senior"]["median"] == 225000

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
    alerts = client.get("/api/v1/alerts").json()
    assert len(alerts) == 1
    assert alerts[0]["profession_slug"] == "role-0"
    updated = client.patch(
        f"/api/v1/alerts/{created.json()['id']}",
        headers={"X-CSRF-Token": csrf},
        json={"enabled": False},
    )
    assert updated.status_code == 200
    assert updated.json()["enabled"] is False
    assert client.get("/api/v1/alerts").json()[0]["enabled"] is False
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


def enable_robokassa_test_payments(monkeypatch):
    monkeypatch.setattr(settings, "payments_enabled", True)
    monkeypatch.setattr(settings, "payments_provider", "robokassa")
    monkeypatch.setattr(settings, "payments_mode", "test")
    monkeypatch.setattr(settings, "premium_30_days_price_rub", Decimal("1.00"))
    monkeypatch.setattr(settings, "payments_terms_version", "draft-test")
    monkeypatch.setattr(settings, "robokassa_merchant_login", "test-merchant")
    monkeypatch.setattr(settings, "robokassa_password1", "test-password-one")
    monkeypatch.setattr(settings, "robokassa_password2", "test-password-two")
    monkeypatch.setattr(settings, "robokassa_password3", "")
    monkeypatch.setattr(settings, "robokassa_hash_algorithm", "sha256")
    monkeypatch.setattr(
        settings,
        "robokassa_payment_url",
        "https://auth.robokassa.test/Merchant/Payment/Index",
    )
    monkeypatch.setattr(settings, "payments_fiscalization_mode", "disabled")


def create_demo_order(client, idempotency_key="checkout-key-0001"):
    return client.post(
        "/api/v1/payments",
        headers={
            "X-CSRF-Token": client.cookies.get("techrole_csrf"),
            "Idempotency-Key": idempotency_key,
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


def test_payment_catalog_is_public_server_priced_and_describes_receipt(monkeypatch):
    enable_demo_payments(monkeypatch)
    client, session = build_client()
    response = client.get("/api/v1/payments/products")
    assert response.status_code == 200
    catalog = response.json()
    assert catalog["enabled"] is True
    assert catalog["mode"] == "test"
    assert [product["code"] for product in catalog["products"]] == ["premium_30_days"]
    product = catalog["products"][0]
    assert product["amount"] == "1.00"
    assert product["access_days"] == 30
    assert product["fulfillment_code"] == "premium_entitlement"
    assert product["receipt"] == {
        "name": "Доступ к сервису TechRole Index Premium на 30 дней",
        "payment_method": "full_payment",
        "payment_object": "service",
        "tax": "none",
    }
    assert product["refund_policy_url"].endswith("/legal/refunds")
    assert client.get("/api/v1/payments").status_code == 401
    client.close()
    session.close()


def test_catalog_uses_only_the_active_scoring_version_for_the_latest_date():
    client, session = build_client()
    previous = session.scalar(select(ScoringVersion).where(ScoringVersion.is_active.is_(True)))
    assert previous is not None
    previous.is_active = False
    current = ScoringVersion(
        version="test-v2",
        weights=DEFAULT_WEIGHTS,
        description="Новая активная версия",
        is_active=True,
    )
    session.add(current)
    session.flush()
    professions = session.scalars(select(Profession).order_by(Profession.id)).all()
    for index, profession in enumerate(professions):
        session.add(
            ProfessionScoreDaily(
                score_date=date(2026, 7, 17),
                profession_id=profession.id,
                scoring_version_id=current.id,
                score=Decimal(str(40 + index)),
                breakdown={"demand": 40 + index},
                data_confidence="medium",
            )
        )
    session.commit()

    response = client.get("/api/v1/professions")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 4
    by_slug = {item["slug"]: item for item in payload}
    assert by_slug["role-1"]["score"] == 41
    assert by_slug["role-2"]["score"] == 42
    assert by_slug["role-3"]["score"] == 43
    session.close()
    app.dependency_overrides.clear()


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
    pending_history = client.get("/api/v1/payments")
    assert pending_history.status_code == 200
    assert pending_history.json()[0] == {
        "order_id": purchase.json()["order_id"],
        "product_code": "premium_30_days",
        "product_name": "Premium на 30 дней",
        "status": "pending",
        "amount": "1.00",
        "currency": "RUB",
        "is_test": True,
        "created_at": pending_history.json()[0]["created_at"],
        "paid_at": None,
        "access_ends_at": None,
        "refunds": [],
    }
    assert "external_payment_id" not in pending_history.text
    assert "confirmation_url" not in pending_history.text

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
    me = client.get("/api/v1/auth/me").json()
    assert me["access_level"] == "premium"
    assert me["premium_expires_at"] is not None
    succeeded_history = client.get("/api/v1/payments").json()
    assert succeeded_history[0]["status"] == "succeeded"
    assert succeeded_history[0]["paid_at"] is not None
    assert succeeded_history[0]["access_ends_at"] is not None

    client.post(
        "/api/v1/auth/login",
        json={"email": "premium@example.com", "password": "PremiumPassword1!"},
    )
    assert client.get("/api/v1/payments").json() == []
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_order_keeps_immutable_product_and_receipt_snapshot(monkeypatch):
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
    assert order.product_snapshot["amount"] == "1.00"
    assert order.product_snapshot["receipt"]["name"] == (
        "Доступ к сервису TechRole Index Premium на 30 дней"
    )

    monkeypatch.setattr(settings, "premium_30_days_price_rub", Decimal("999.00"))
    status = client.get(f"/api/v1/payments/{order.public_id}")
    assert status.status_code == 200
    assert status.json()["amount"] == "1.00"
    completed = client.post(
        f"/api/v1/payments/{order.public_id}/demo/complete",
        headers={"X-CSRF-Token": client.cookies.get("techrole_csrf")},
        json={"outcome": "succeeded"},
    )
    assert completed.status_code == 200
    assert completed.json()["amount"] == "1.00"
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


def test_robokassa_result_url_rejects_tampering_and_acknowledges_replays(monkeypatch):
    enable_robokassa_test_payments(monkeypatch)
    client, session = build_client()
    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    purchase = create_demo_order(client)
    assert purchase.status_code == 200
    order = session.scalar(
        select(PaymentOrder).where(PaymentOrder.public_id == purchase.json()["order_id"])
    )
    assert order is not None and order.external_payment_id is not None

    def callback(amount: str, signature: str | None = None) -> bytes:
        values = {
            "OutSum": amount,
            "InvId": order.external_payment_id,
            "Shp_order_id": order.public_id,
            "IsTest": "1",
        }
        signature_base = (
            f"{amount}:{order.external_payment_id}:test-password-two:"
            f"Shp_order_id={order.public_id}"
        )
        values["SignatureValue"] = signature or hashlib.sha256(
            signature_base.encode()
        ).hexdigest()
        return urlencode(values).encode()

    endpoint = "/api/v1/payments/webhooks/robokassa"
    assert client.post(endpoint, content=callback("1.00", "0" * 64)).status_code == 401
    assert client.post(endpoint, content=callback("0.01")).status_code == 422
    assert client.get("/api/v1/auth/me").json()["access_level"] == "free"

    first = client.post(endpoint, content=callback("1.00"))
    repeated = client.post(endpoint, content=callback("1.00"))
    assert first.status_code == 200 and first.text == f"OK{order.external_payment_id}"
    assert repeated.status_code == 200 and repeated.text == f"OK{order.external_payment_id}"
    assert client.get("/api/v1/auth/me").json()["access_level"] == "premium"
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


def test_refund_of_an_earlier_extension_removes_exactly_its_access_days(monkeypatch):
    enable_demo_payments(monkeypatch)
    client, session = build_client()
    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    first = create_demo_order(client, "checkout-extension-0001")
    second = create_demo_order(client, "checkout-extension-0002")
    for purchase in (first, second):
        completed = client.post(
            f"/api/v1/payments/{purchase.json()['order_id']}/demo/complete",
            headers={"X-CSRF-Token": client.cookies.get("techrole_csrf")},
            json={"outcome": "succeeded"},
        )
        assert completed.status_code == 200

    entitlements = session.scalars(
        select(Entitlement)
        .where(Entitlement.source.like("payment:%"))
        .order_by(Entitlement.ends_at)
    ).all()
    assert len(entitlements) == 2
    assert entitlements[0].ends_at is not None
    assert entitlements[1].starts_at == entitlements[0].ends_at
    assert entitlements[1].ends_at is not None
    expiry_before = entitlements[1].ends_at

    client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "AdminPassword1!"},
    )
    refunded = client.post(
        f"/api/v1/payments/{first.json()['order_id']}/refund",
        headers={
            "X-CSRF-Token": client.cookies.get("techrole_csrf"),
            "Idempotency-Key": "refund-extension-0001",
        },
        json={"reason": "customer_request"},
    )
    assert refunded.status_code == 200
    assert refunded.json()["status"] == "succeeded"

    session.refresh(entitlements[0])
    session.refresh(entitlements[1])
    assert entitlements[0].revoked_at is not None
    assert entitlements[1].ends_at == expiry_before - timedelta(days=30)
    assert entitlements[1].starts_at == entitlements[0].starts_at

    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    me = client.get("/api/v1/auth/me").json()
    assert me["access_level"] == "premium"
    assert datetime.fromisoformat(me["premium_expires_at"]) == entitlements[1].ends_at
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_payment_readiness_is_admin_only_and_contains_no_secrets(monkeypatch):
    client, session = build_client()
    assert client.get("/api/v1/admin/payment-readiness").status_code == 401

    client.post(
        "/api/v1/auth/login",
        json={"email": "free@example.com", "password": "FreePassword1!"},
    )
    assert client.get("/api/v1/admin/payment-readiness").status_code == 403

    secret_values = {
        "robokassa_merchant_login": "merchant-private-value",
        "robokassa_password1": "password-one-private-value",
        "robokassa_password2": "password-two-private-value",
        "robokassa_password3": "password-three-private-value",
    }
    for name, value in secret_values.items():
        monkeypatch.setattr(settings, name, value)
    monkeypatch.setattr(settings, "payments_provider", "robokassa")

    client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "AdminPassword1!"},
    )
    response = client.get("/api/v1/admin/payment-readiness")
    serialized = response.text

    assert response.status_code == 200
    assert response.json()["provider"] == "robokassa"
    assert not any(value in serialized for value in secret_values.values())
    client.close()
    session.close()
    app.dependency_overrides.clear()


def test_privacy_first_analytics_counts_humans_and_declared_crawlers(monkeypatch):
    monkeypatch.setattr(settings, "analytics_enabled", True)
    monkeypatch.setattr(settings, "analytics_ingest_key", "ingest-key-with-at-least-thirty-two-chars")
    monkeypatch.setattr(settings, "analytics_hash_key", "hash-key-with-at-least-thirty-two-characters")
    client, session = build_client()
    headers = {
        "Origin": settings.frontend_origin,
        "User-Agent": "Mozilla/5.0 Test Browser",
    }
    visitor = "visitor_identifier_000000000001"

    for path in ("/", "/professions"):
        response = client.post(
            "/api/v1/analytics/events",
            headers=headers,
            json={"visitor_id": visitor, "event_type": "pageview", "path": path},
        )
        assert response.status_code == 202
    assert client.post(
        "/api/v1/analytics/events",
        headers=headers,
        json={
            "visitor_id": visitor,
            "event_type": "click",
            "path": "/",
            "target_path": "/professions#catalog",
        },
    ).status_code == 202
    assert client.post(
        "/api/v1/analytics/events",
        headers=headers,
        json={
            "visitor_id": visitor,
            "event_type": "citation_copy",
            "path": "/professions/role-0",
            "referrer_host": "chatgpt.com",
        },
    ).status_code == 202
    private = client.post(
        "/api/v1/analytics/events",
        headers=headers,
        json={"visitor_id": visitor, "event_type": "pageview", "path": "/account"},
    )
    assert private.json()["status"] == "ignored_private_or_invalid"

    assert client.post(
        "/api/v1/analytics/crawler",
        headers={"X-Analytics-Ingest-Key": "wrong-key"},
        json={"crawler_name": "OAI-SearchBot", "category": "ai_crawler", "path": "/answers"},
    ).status_code == 401
    crawler = client.post(
        "/api/v1/analytics/crawler",
        headers={"X-Analytics-Ingest-Key": settings.analytics_ingest_key},
        json={"crawler_name": "OAI-SearchBot", "category": "ai_crawler", "path": "/answers"},
    )
    assert crawler.status_code == 202

    client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "AdminPassword1!"},
    )
    excluded = client.post(
        "/api/v1/analytics/events",
        headers=headers,
        json={
            "visitor_id": "owner_identifier_0000000000001",
            "event_type": "pageview",
            "path": "/",
        },
    )
    assert excluded.json()["status"] == "excluded_owner"
    report = client.get("/api/v1/admin/analytics?days=7")
    assert report.status_code == 200
    payload = report.json()
    assert payload["totals"]["unique_humans"] == 1
    assert payload["totals"]["pageviews"] == 2
    assert payload["totals"]["clicks"] == 1
    assert payload["totals"]["citation_copies"] == 1
    assert payload["totals"]["ai_crawler_requests"] == 1
    assert payload["click_targets"][0] == {"label": "/professions#catalog", "count": 1}
    assert payload["crawlers"][0] == {"label": "OAI-SearchBot", "count": 1}
    assert "visitor_identifier" not in report.text
    assert all(event.visitor_hash != visitor for event in session.scalars(select(AnalyticsEvent)))
    client.close()
    session.close()
    app.dependency_overrides.clear()
