from app.config import Settings
from app.services.payment_readiness import payment_readiness


def configured_robokassa(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "production",
        "database_url": (
            "postgresql+psycopg://techrole_prod:"
            "database-password-0123456789@postgres:5432/techrole_prod"
        ),
        "demo_mode": False,
        "payments_enabled": True,
        "payments_provider": "robokassa",
        "payments_mode": "live",
        "payments_live_confirmed": True,
        "payments_legal_approved": True,
        "payments_stable_https_confirmed": True,
        "payments_terms_version": "offer-2026-07-22",
        "payments_seller_status": "self_employed",
        "payments_fiscalization_mode": "robokassa",
        "payments_robocheki_smz_confirmed": True,
        "robokassa_merchant_login": "merchant-placeholder",
        "robokassa_live_password1": "password-one-placeholder",
        "robokassa_live_password2": "password-two-placeholder",
        "robokassa_live_password3": "password-three-placeholder",
        "robokassa_payment_url": "https://auth.robokassa.ru/Merchant/Index.aspx",
        "public_base_url": "https://techrole.example",
        "frontend_origin": "https://techrole.example",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_live_readiness_requires_every_fail_closed_guard() -> None:
    report = payment_readiness(configured_robokassa())

    assert report.live_ready is True
    assert all(check.ready for check in report.live_checks)
    assert report.result_url == (
        "https://techrole.example/api/v1/payments/webhooks/robokassa"
    )


def test_test_readiness_accepts_test_shop_without_live_confirmation() -> None:
    report = payment_readiness(
        Settings(
            _env_file=None,
            payments_enabled=True,
            payments_provider="robokassa",
            payments_mode="test",
            payments_seller_status="self_employed",
            robokassa_merchant_login="merchant-placeholder",
            robokassa_password1="password-one-placeholder",
            robokassa_password2="password-two-placeholder",
            public_base_url="https://preview.example",
            frontend_origin="https://preview.example",
        )
    )

    assert report.test_ready is True
    assert report.live_ready is False


def test_live_readiness_fails_closed_without_fresh_robocheki_confirmation() -> None:
    report = payment_readiness(
        configured_robokassa(
            payments_mode="test",
            payments_live_confirmed=False,
            payments_robocheki_smz_confirmed=False,
            robokassa_test_password1="test-password-one-placeholder",
            robokassa_test_password2="test-password-two-placeholder",
        )
    )

    check = next(
        item for item in report.live_checks if item.code == "robocheki_smz_confirmed"
    )
    assert check.ready is False
    assert report.live_ready is False


def test_readiness_response_never_contains_provider_secrets() -> None:
    secrets = (
        "merchant-placeholder",
        "password-one-placeholder",
        "password-two-placeholder",
        "password-three-placeholder",
    )

    serialized = payment_readiness(configured_robokassa()).model_dump_json()

    assert not any(secret in serialized for secret in secrets)
