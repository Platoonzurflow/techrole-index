from __future__ import annotations

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import (
    Base,
    Profession,
    ProfessionMetricDaily,
    ScoringVersion,
    User,
    Vacancy,
    VacancySource,
)
from app.seed import (
    _assert_production_catalog_safe,
    _seed_reference,
    _seed_sources_and_scoring,
)


def production_settings(**overrides: object) -> Settings:
    synthetic_signing_key = "-".join(
        ("test", "only", "not", "a", "credential", "repeatable", "value")
    )
    values: dict[str, object] = {
        "app_env": "production",
        "app_secret_key": synthetic_signing_key,
        "database_url": (
            "postgresql+psycopg://techrole_prod:"
            "database-password-0123456789@postgres:5432/techrole_prod"
        ),
        "frontend_origin": "https://techrole.example",
        "public_base_url": "https://techrole.example",
        "demo_mode": False,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_secure_production_settings_are_accepted() -> None:
    settings = production_settings()
    assert settings.app_env == "production"
    assert settings.demo_mode is False


def test_production_analytics_fail_closed_until_distinct_keys_are_configured() -> None:
    with pytest.raises(ValidationError, match="ANALYTICS_INGEST_KEY"):
        production_settings(analytics_enabled=True)

    repeated = "test-key-" + ("a" * 40)
    with pytest.raises(ValidationError, match="must differ"):
        production_settings(
            analytics_enabled=True,
            analytics_ingest_key=repeated,
            analytics_hash_key=repeated,
        )

    configured = production_settings(
        analytics_enabled=True,
        analytics_ingest_key="test-ingest-" + ("a" * 40),
        analytics_hash_key="test-hash-" + ("b" * 40),
    )
    assert configured.analytics_enabled is True


def test_live_payments_fail_closed_until_legal_and_fiscal_details_are_final() -> None:
    base = {
        "payments_enabled": True,
        "payments_mode": "live",
        "payments_provider": "yookassa",
        "yookassa_shop_id": "shop-id",
        "yookassa_secret_key": "production-key-placeholder",
        "payments_live_confirmed": True,
        "payments_legal_approved": True,
        "payments_stable_https_confirmed": True,
        "payments_seller_status": "sole_proprietor",
        "payments_fiscalization_mode": "yookassa",
        "yookassa_vat_code": 1,
    }
    with pytest.raises(ValidationError, match="PAYMENTS_TERMS_VERSION"):
        Settings(_env_file=None, **base)

    unstable = {**base, "payments_stable_https_confirmed": False}
    with pytest.raises(ValidationError, match="PAYMENTS_STABLE_HTTPS_CONFIRMED"):
        Settings(
            _env_file=None,
            **unstable,
            payments_terms_version="offer-2026-07-21",
        )

    configured = Settings(
        _env_file=None,
        **base,
        payments_terms_version="offer-2026-07-21",
    )
    assert configured.payments_mode == "live"


def test_live_self_employed_mode_cannot_claim_online_cash_register_fiscalization() -> None:
    with pytest.raises(ValidationError, match="self_employed_manual"):
        Settings(
            _env_file=None,
            payments_enabled=True,
            payments_mode="live",
            payments_provider="yookassa",
            yookassa_shop_id="shop-id",
            yookassa_secret_key="production-key-placeholder",
            payments_live_confirmed=True,
            payments_legal_approved=True,
            payments_stable_https_confirmed=True,
            payments_terms_version="offer-2026-07-21",
            payments_seller_status="self_employed",
            payments_fiscalization_mode="yookassa",
            yookassa_vat_code=1,
        )


def test_live_self_employed_robokassa_requires_automatic_receipts_and_refund_key() -> None:
    base = {
        "payments_enabled": True,
        "payments_mode": "live",
        "payments_provider": "robokassa",
        "robokassa_merchant_login": "merchant",
        "robokassa_live_password1": "test-password-one",
        "robokassa_live_password2": "test-password-two",
        "robokassa_payment_url": "https://auth.robokassa.ru/Merchant/Index.aspx",
        "payments_live_confirmed": True,
        "payments_legal_approved": True,
        "payments_stable_https_confirmed": True,
        "payments_terms_version": "offer-2026-07-22",
        "payments_seller_status": "self_employed",
    }
    with pytest.raises(ValidationError, match="robokassa fiscalization"):
        Settings(
            _env_file=None,
            **base,
            payments_fiscalization_mode="self_employed_manual",
            robokassa_live_password3="test-password-three",
        )
    with pytest.raises(ValidationError, match="ROBOKASSA_LIVE_PASSWORD3"):
        Settings(
            _env_file=None,
            **base,
            payments_fiscalization_mode="robokassa",
            payments_robocheki_smz_confirmed=True,
        )
    with pytest.raises(ValidationError, match="PAYMENTS_ROBOCHEKI_SMZ_CONFIRMED"):
        Settings(
            _env_file=None,
            **base,
            payments_fiscalization_mode="robokassa",
            robokassa_live_password3="test-password-three",
        )
    configured = Settings(
        _env_file=None,
        **base,
        payments_fiscalization_mode="robokassa",
        payments_robocheki_smz_confirmed=True,
        robokassa_live_password3="test-password-three",
    )
    assert configured.payments_provider == "robokassa"


def test_live_payment_providers_reject_non_official_api_endpoints() -> None:
    robokassa = {
        "payments_enabled": True,
        "payments_mode": "live",
        "payments_provider": "robokassa",
        "robokassa_merchant_login": "merchant",
        "robokassa_live_password1": "test-password-one",
        "robokassa_live_password2": "test-password-two",
        "robokassa_live_password3": "test-password-three",
        "robokassa_payment_url": "https://auth.robokassa.ru/Merchant/Index.aspx",
        "payments_live_confirmed": True,
        "payments_legal_approved": True,
        "payments_stable_https_confirmed": True,
        "payments_terms_version": "offer-2026-07-22",
        "payments_seller_status": "self_employed",
        "payments_fiscalization_mode": "robokassa",
        "payments_robocheki_smz_confirmed": True,
    }
    with pytest.raises(ValidationError, match="official ROBOKASSA_REFUND_URL"):
        Settings(
            _env_file=None,
            **robokassa,
            robokassa_refund_url="https://example.test/collect-credentials",
        )

    with pytest.raises(ValidationError, match="official YOOKASSA_API_URL"):
        Settings(
            _env_file=None,
            payments_enabled=True,
            payments_mode="live",
            payments_provider="yookassa",
            yookassa_shop_id="shop-id",
            yookassa_secret_key="production-key-placeholder",
            yookassa_api_url="https://example.test/v3",
            payments_live_confirmed=True,
            payments_legal_approved=True,
            payments_stable_https_confirmed=True,
            payments_terms_version="offer-2026-07-22",
            payments_seller_status="self_employed",
            payments_fiscalization_mode="self_employed_manual",
        )


def test_robokassa_company_receipts_fail_closed_until_vat_contract_exists() -> None:
    with pytest.raises(ValidationError, match="VAT-aware receipt contract"):
        Settings(
            _env_file=None,
            payments_enabled=True,
            payments_mode="live",
            payments_provider="robokassa",
            robokassa_merchant_login="merchant",
            robokassa_live_password1="test-password-one",
            robokassa_live_password2="test-password-two",
            robokassa_live_password3="test-password-three",
            robokassa_payment_url="https://auth.robokassa.ru/Merchant/Index.aspx",
            payments_live_confirmed=True,
            payments_legal_approved=True,
            payments_stable_https_confirmed=True,
            payments_terms_version="offer-2026-07-22",
            payments_seller_status="sole_proprietor",
            payments_fiscalization_mode="robokassa",
        )


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"demo_mode": True}, "DEMO_MODE must be false"),
        ({"app_secret_key": "development-only-change-me"}, "APP_SECRET_KEY"),
        ({"public_base_url": "http://localhost:3000"}, "PUBLIC_BASE_URL"),
        ({"public_base_url": "https://techrole.example/app"}, "without path"),
        ({"frontend_origin": "https://other.example"}, "must match"),
        (
            {"database_url": "postgresql+psycopg://techrole:techrole@postgres/techrole"},
            "DATABASE_URL",
        ),
        (
            {
                "database_url": (
                    "postgresql+psycopg://techrole_prod:"
                    "database-password-0123456789@localhost:5432/techrole_prod"
                )
            },
            "non-local database host",
        ),
    ],
)
def test_unsafe_production_settings_are_rejected(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        production_settings(**overrides)


def test_reference_bootstrap_contains_no_demo_accounts_or_metrics() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        professions, _, _ = _seed_reference(db)
        _seed_sources_and_scoring(db, demo_enabled=False)
        db.commit()

        assert len(professions) == 50
        assert db.scalar(select(func.count(Profession.id))) == 50
        assert db.scalar(select(func.count(User.id))) == 0
        assert db.scalar(select(func.count(Vacancy.id))) == 0
        assert db.scalar(select(func.count(ProfessionMetricDaily.id))) == 0
        demo_source = db.scalar(select(VacancySource).where(VacancySource.code == "demo"))
        assert demo_source is not None
        assert demo_source.enabled is False
        _assert_production_catalog_safe(db)
    engine.dispose()


def test_reference_bootstrap_reuses_scoring_version_created_by_migration() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        existing = ScoringVersion(
            version="v1.1.0",
            weights={"legacy": 1.0},
            description="migration placeholder",
            is_active=True,
        )
        db.add(existing)
        db.commit()

        _, scoring = _seed_sources_and_scoring(db, demo_enabled=False)
        db.commit()

        assert scoring.id == existing.id
        assert db.scalar(select(func.count(ScoringVersion.id))) == 1
        assert scoring.weights == {
            "demand": 0.28,
            "salary": 0.24,
            "demand_growth": 0.16,
            "junior_access": 0.12,
            "remote_share": 0.10,
            "data_quality": 0.10,
        }
        assert scoring.is_active is True
    engine.dispose()


def test_production_bootstrap_rejects_enabled_demo_source() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        _seed_reference(db)
        _seed_sources_and_scoring(db, demo_enabled=True)
        db.commit()
        with pytest.raises(RuntimeError, match="Production bootstrap refused"):
            _assert_production_catalog_safe(db)
    engine.dispose()
