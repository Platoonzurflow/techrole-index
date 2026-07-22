from decimal import Decimal
from functools import lru_cache
from urllib.parse import unquote, urlsplit

from pydantic import EmailStr, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "development"
    app_secret_key: str = "development-only-change-me"
    database_url: str = "sqlite:///./techrole.sqlite3"
    redis_url: str = "redis://localhost:6379/0"
    catalog_cache_enabled: bool = False
    catalog_cache_ttl_seconds: int = Field(default=120, ge=5, le=3600)
    frontend_origin: str = "http://localhost:3000"
    public_base_url: str = "http://localhost:3000"
    demo_mode: bool = True
    demo_seed: int = 20260717
    min_salary_sample: int = Field(default=20, ge=3, le=1000)

    payments_enabled: bool = False
    payments_provider: str = "demo"
    payments_mode: str = "test"
    payments_live_confirmed: bool = False
    payments_legal_approved: bool = False
    payments_stable_https_confirmed: bool = False
    payments_terms_version: str = "draft-2026-07-21"
    payments_seller_status: str = "unconfirmed"
    payments_fiscalization_mode: str = "disabled"
    premium_30_days_price_rub: Decimal = Field(default=Decimal("290.00"), gt=0)
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_api_url: str = "https://api.yookassa.ru/v3"
    yookassa_timeout_seconds: float = Field(default=15, ge=3, le=60)
    yookassa_vat_code: int = Field(default=0, ge=0, le=12)
    robokassa_merchant_login: str = ""
    robokassa_password1: str = ""
    robokassa_password2: str = ""
    robokassa_password3: str = ""
    robokassa_hash_algorithm: str = "sha256"
    robokassa_payment_url: str = "https://auth.robokassa.ru/Merchant/Payment/Index"
    robokassa_op_state_url: str = (
        "https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt"
    )
    robokassa_refund_url: str = (
        "https://services.robokassa.ru/RefundService/Refund/Create"
    )
    robokassa_refund_state_url: str = (
        "https://services.robokassa.ru/RefundService/Refund/GetState"
    )
    robokassa_timeout_seconds: float = Field(default=15, ge=3, le=60)

    cbr_currency_enabled: bool = False
    cbr_currency_base_url: str = "https://www.cbr.ru/scripts/XML_daily.asp"
    cbr_currency_timeout_seconds: float = Field(default=15, ge=3, le=60)
    salary_source_audit_enabled: bool = False
    salary_source_audit_timeout_seconds: float = Field(default=15, ge=3, le=60)

    demo_free_password: str = "FreeDemo-ChangeMe1!"
    demo_premium_password: str = "PremiumDemo-ChangeMe1!"
    demo_admin_password: str = "AdminDemo-ChangeMe1!"

    hh_enabled: bool = False
    hh_commercial_use_confirmed: bool = False
    hh_contact_email: str = ""
    hh_app_name: str = "TechRoleIndex"
    hh_access_token: str = ""

    ai_classifier_enabled: bool = False
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = ""
    ai_classifier_timeout_seconds: int = Field(default=300, ge=30, le=900)
    ai_classifier_max_per_run: int = Field(default=3, ge=0, le=20)

    trudvsem_enabled: bool = False
    trudvsem_base_url: str = "https://opendata.trudvsem.ru/api/v1"
    trudvsem_terms_url: str = "https://trudvsem.ru/opendata/api"
    trudvsem_query_limit: int = Field(default=20, ge=1, le=100)
    trudvsem_max_professions: int = Field(default=50, ge=1, le=100)
    trudvsem_history_days: int = Field(default=180, ge=7, le=365)
    trudvsem_max_pages_per_query: int = Field(default=100, ge=1, le=100)
    trudvsem_use_alias_queries: bool = True
    trudvsem_request_delay_seconds: float = Field(default=0.25, ge=0, le=5)

    support_email_enabled: bool = False
    nightly_report_email_enabled: bool = False
    support_recipient_email: EmailStr = "sqldevelopermoscow@yandex.com"
    smtp_host: str = "smtp.yandex.ru"
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: EmailStr | None = None
    smtp_use_ssl: bool = True
    smtp_timeout_seconds: int = Field(default=15, ge=3, le=60)

    access_cookie_name: str = "techrole_session"
    csrf_cookie_name: str = "techrole_csrf"
    support_csrf_cookie_name: str = "techrole_support_csrf"
    mentorship_csrf_cookie_name: str = "techrole_mentorship_csrf"
    access_token_minutes: int = 60 * 24 * 7

    @model_validator(mode="after")
    def validate_hh_guard(self) -> "Settings":
        if self.hh_enabled and not (
            self.hh_commercial_use_confirmed and self.hh_contact_email and self.hh_app_name
        ):
            raise ValueError(
                "HH_ENABLED requires HH_COMMERCIAL_USE_CONFIRMED=true, HH_CONTACT_EMAIL and HH_APP_NAME"
            )
        if (self.support_email_enabled or self.nightly_report_email_enabled) and not (
            self.smtp_host and self.smtp_username and self.smtp_password
        ):
            raise ValueError(
                "Email delivery requires SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD"
            )
        if self.payments_provider not in {"demo", "yookassa", "robokassa"}:
            raise ValueError("PAYMENTS_PROVIDER must be demo, yookassa or robokassa")
        if self.payments_mode not in {"test", "live"}:
            raise ValueError("PAYMENTS_MODE must be test or live")
        if self.payments_seller_status not in {
            "unconfirmed",
            "self_employed",
            "sole_proprietor",
            "company",
        }:
            raise ValueError(
                "PAYMENTS_SELLER_STATUS must be unconfirmed, self_employed, "
                "sole_proprietor or company"
            )
        if self.payments_fiscalization_mode not in {
            "disabled",
            "self_employed_manual",
            "yookassa",
            "robokassa",
            "third_party",
        }:
            raise ValueError(
                "PAYMENTS_FISCALIZATION_MODE must be disabled, self_employed_manual, "
                "yookassa, robokassa or third_party"
            )
        if self.payments_enabled and self.payments_provider == "yookassa" and not (
            self.yookassa_shop_id and self.yookassa_secret_key
        ):
            raise ValueError(
                "YooKassa payments require YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY"
            )
        if self.robokassa_hash_algorithm.lower() not in {
            "md5",
            "sha1",
            "sha256",
            "sha384",
            "sha512",
        }:
            raise ValueError(
                "ROBOKASSA_HASH_ALGORITHM must match a supported shop algorithm"
            )
        if self.payments_enabled and self.payments_provider == "robokassa" and not (
            self.robokassa_merchant_login
            and self.robokassa_password1
            and self.robokassa_password2
        ):
            raise ValueError(
                "Robokassa payments require ROBOKASSA_MERCHANT_LOGIN, "
                "ROBOKASSA_PASSWORD1 and ROBOKASSA_PASSWORD2"
            )
        if self.payments_mode == "live":
            if not self.payments_live_confirmed:
                raise ValueError("Live payments require PAYMENTS_LIVE_CONFIRMED=true")
            if not self.payments_legal_approved:
                raise ValueError("Live payments require PAYMENTS_LEGAL_APPROVED=true")
            if not self.payments_stable_https_confirmed:
                raise ValueError(
                    "Live payments require PAYMENTS_STABLE_HTTPS_CONFIRMED=true"
                )
            if not self.payments_terms_version or self.payments_terms_version.startswith(
                "draft-"
            ):
                raise ValueError("Live payments require an approved PAYMENTS_TERMS_VERSION")
            if self.payments_provider == "demo":
                raise ValueError("Demo provider cannot be used for live payments")
            if self.payments_seller_status == "unconfirmed":
                raise ValueError("Live payments require a confirmed seller status")
            if self.payments_fiscalization_mode == "disabled":
                raise ValueError("Live payments require a fiscalization mode")
            if self.payments_seller_status == "self_employed":
                required_mode = (
                    "robokassa"
                    if self.payments_provider == "robokassa"
                    else "self_employed_manual"
                )
                if self.payments_fiscalization_mode != required_mode:
                    raise ValueError(
                        f"Self-employed live payments require {required_mode} fiscalization"
                    )
            if self.payments_seller_status in {"sole_proprietor", "company"} and (
                self.payments_fiscalization_mode
                not in {"yookassa", "robokassa", "third_party"}
            ):
                raise ValueError(
                    "Sole proprietors and companies require a configured online cash register"
                )
            if (
                self.payments_fiscalization_mode == "yookassa"
                and self.yookassa_vat_code == 0
            ):
                raise ValueError("Live receipt fiscalization requires YOOKASSA_VAT_CODE")
            if self.payments_provider == "robokassa":
                if not self.robokassa_password3:
                    raise ValueError("Robokassa live refunds require ROBOKASSA_PASSWORD3")
                official_urls = {
                    "ROBOKASSA_PAYMENT_URL": (
                        self.robokassa_payment_url,
                        "https://auth.robokassa.ru/Merchant/Payment/Index",
                    ),
                    "ROBOKASSA_OP_STATE_URL": (
                        self.robokassa_op_state_url,
                        "https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt",
                    ),
                    "ROBOKASSA_REFUND_URL": (
                        self.robokassa_refund_url,
                        "https://services.robokassa.ru/RefundService/Refund/Create",
                    ),
                    "ROBOKASSA_REFUND_STATE_URL": (
                        self.robokassa_refund_state_url,
                        "https://services.robokassa.ru/RefundService/Refund/GetState",
                    ),
                }
                for setting_name, (actual, expected) in official_urls.items():
                    if actual.rstrip("/") != expected:
                        raise ValueError(f"Live Robokassa requires official {setting_name}")
                if (
                    self.payments_seller_status in {"sole_proprietor", "company"}
                    and self.payments_fiscalization_mode == "robokassa"
                ):
                    raise ValueError(
                        "Robokassa fiscalization for sole proprietors and companies "
                        "requires a separately implemented VAT-aware receipt contract"
                    )
            if (
                self.payments_provider == "yookassa"
                and self.yookassa_api_url.rstrip("/") != "https://api.yookassa.ru/v3"
            ):
                raise ValueError("Live YooKassa requires the official YOOKASSA_API_URL")
        if self.app_env.lower() == "production":
            errors: list[str] = []
            if self.demo_mode:
                errors.append("DEMO_MODE must be false")
            if len(self.app_secret_key) < 32 or self.app_secret_key in {
                "development-only-change-me",
                "change-me-to-a-long-random-value",
            }:
                errors.append("APP_SECRET_KEY must be a new random value of at least 32 characters")

            public_url = urlsplit(self.public_base_url)
            frontend_url = urlsplit(self.frontend_origin)
            local_hosts = {"localhost", "127.0.0.1", "::1"}
            if public_url.scheme != "https" or public_url.hostname in local_hosts:
                errors.append("PUBLIC_BASE_URL must use a non-local HTTPS host")
            if public_url.path not in {"", "/"} or public_url.query or public_url.fragment:
                errors.append("PUBLIC_BASE_URL must be an origin without path, query or fragment")
            if frontend_url.scheme != "https" or frontend_url.hostname in local_hosts:
                errors.append("FRONTEND_ORIGIN must use a non-local HTTPS host")
            if frontend_url.path not in {"", "/"} or frontend_url.query or frontend_url.fragment:
                errors.append("FRONTEND_ORIGIN must be an origin without path, query or fragment")
            if self.public_base_url.rstrip("/") != self.frontend_origin.rstrip("/"):
                errors.append("PUBLIC_BASE_URL and FRONTEND_ORIGIN must match")

            database_url = urlsplit(self.database_url)
            database_password = unquote(database_url.password or "")
            if not database_url.scheme.startswith("postgresql"):
                errors.append("DATABASE_URL must use PostgreSQL")
            if database_url.hostname in local_hosts or not database_url.hostname:
                errors.append("DATABASE_URL must use a non-local database host")
            if len(database_password) < 16 or database_password == "techrole":
                errors.append("DATABASE_URL must contain a non-default password of at least 16 characters")
            if errors:
                raise ValueError("Unsafe production configuration: " + "; ".join(errors))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
