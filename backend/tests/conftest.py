import os

os.environ.update(
    {
        "APP_ENV": "test",
        "APP_SECRET_KEY": "test-secret-key-with-enough-entropy",
        "DATABASE_URL": "sqlite:///./test-techrole.sqlite3",
        "FRONTEND_ORIGIN": "http://localhost:3000",
        "PUBLIC_BASE_URL": "http://localhost:3000",
        "CATALOG_CACHE_ENABLED": "false",
        "AI_CLASSIFIER_ENABLED": "false",
        "HH_ENABLED": "false",
        "TRUDVSEM_ENABLED": "false",
        "CBR_CURRENCY_ENABLED": "false",
        "SUPPORT_EMAIL_ENABLED": "false",
        "NIGHTLY_REPORT_EMAIL_ENABLED": "false",
    }
)
