from urllib.parse import urlsplit

from app.config import Settings
from app.schemas import PaymentReadinessCheck, PaymentReadinessOut

ROBOKASSA_OFFICIAL_URLS = {
    "payment": "https://auth.robokassa.ru/Merchant/Index.aspx",
    "operation_state": (
        "https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt"
    ),
    "refund": "https://services.robokassa.ru/RefundService/Refund/Create",
    "refund_state": "https://services.robokassa.ru/RefundService/Refund/GetState",
}


def _check(code: str, label: str, ready: bool) -> PaymentReadinessCheck:
    return PaymentReadinessCheck(code=code, label=label, ready=ready)


def _is_public_https_origin(value: str) -> bool:
    parsed = urlsplit(value)
    return bool(
        parsed.scheme == "https"
        and parsed.hostname
        and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
        and parsed.path in {"", "/"}
        and not parsed.query
        and not parsed.fragment
    )


def payment_readiness(config: Settings) -> PaymentReadinessOut:
    provider_selected = config.payments_provider == "robokassa"
    test_credentials = bool(
        config.robokassa_merchant_login
        and (config.robokassa_test_password1 or config.robokassa_password1)
        and (config.robokassa_test_password2 or config.robokassa_password2)
    )
    live_credentials = bool(
        config.robokassa_merchant_login
        and config.robokassa_live_password1
        and config.robokassa_live_password2
    )
    public_https = _is_public_https_origin(config.public_base_url)
    origins_match = (
        config.public_base_url.rstrip("/") == config.frontend_origin.rstrip("/")
    )
    official_urls = (
        config.robokassa_payment_url.rstrip("/")
        == ROBOKASSA_OFFICIAL_URLS["payment"]
    ) and (
        config.robokassa_op_state_url.rstrip("/")
        == ROBOKASSA_OFFICIAL_URLS["operation_state"]
        and config.robokassa_refund_url.rstrip("/")
        == ROBOKASSA_OFFICIAL_URLS["refund"]
        and config.robokassa_refund_state_url.rstrip("/")
        == ROBOKASSA_OFFICIAL_URLS["refund_state"]
    )

    test_checks = [
        _check("provider", "Выбрана Robokassa", provider_selected),
        _check("test_mode", "Включён тестовый режим", config.payments_mode == "test"),
        _check(
            "payments_enabled",
            "Приём тестовых платежей включён",
            config.payments_enabled,
        ),
        _check(
            "provider_credentials",
            "Заданы MerchantLogin и тестовые Пароли №1/№2",
            test_credentials,
        ),
        _check(
            "seller_status",
            "Статус продавца указан как самозанятый НПД",
            config.payments_seller_status == "self_employed",
        ),
        _check("public_https", "Настроен публичный HTTPS-адрес", public_https),
        _check("matching_origins", "Адреса сайта и возврата совпадают", origins_match),
    ]

    live_checks = [
        _check("provider", "Выбрана Robokassa", provider_selected),
        _check("live_mode", "Включён боевой режим", config.payments_mode == "live"),
        _check("payments_enabled", "Приём платежей включён", config.payments_enabled),
        _check(
            "provider_credentials",
            "Заданы боевые Пароли №1/№2",
            live_credentials,
        ),
        _check(
            "refund_credentials",
            "Задан Пароль №3 для возвратов",
            bool(config.robokassa_live_password3),
        ),
        _check(
            "seller_status",
            "Статус продавца указан как самозанятый НПД",
            config.payments_seller_status == "self_employed",
        ),
        _check(
            "fiscalization",
            "Выбран режим «Робочеки СМЗ»",
            config.payments_fiscalization_mode == "robokassa",
        ),
        _check(
            "robocheki_smz_confirmed",
            "Владелец повторно проверил активный статус «Робочеки СМЗ»",
            config.payments_robocheki_smz_confirmed,
        ),
        _check("legal_approved", "Оферта и правила проверены", config.payments_legal_approved),
        _check(
            "terms_approved",
            "Указана утверждённая версия оферты",
            bool(config.payments_terms_version)
            and not config.payments_terms_version.startswith("draft-"),
        ),
        _check(
            "stable_https",
            "Подтверждены постоянный HTTPS-домен и круглосуточный хостинг",
            config.payments_stable_https_confirmed and public_https and origins_match,
        ),
        _check("official_urls", "Используются официальные адреса Robokassa", official_urls),
        _check(
            "production_runtime",
            "Приложение работает в production без демо-данных",
            config.app_env.lower() == "production" and not config.demo_mode,
        ),
        _check(
            "owner_confirmation",
            "Владелец явно разрешил реальные списания",
            config.payments_live_confirmed,
        ),
    ]

    return PaymentReadinessOut(
        provider=config.payments_provider,
        mode=config.payments_mode,
        payments_enabled=config.payments_enabled,
        test_ready=all(item.ready for item in test_checks),
        live_ready=all(item.ready for item in live_checks),
        test_checks=test_checks,
        live_checks=live_checks,
        result_url=(
            f"{config.public_base_url.rstrip('/')}/api/v1/payments/webhooks/robokassa"
            if public_https
            else None
        ),
    )
