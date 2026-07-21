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
    values: dict[str, object] = {
        "app_env": "production",
        "app_secret_key": "prod-secret-0123456789-abcdefghijklmnop",
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
