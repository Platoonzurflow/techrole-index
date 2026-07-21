import pytest
from pydantic import ValidationError

from app.config import Settings
from app.providers.vacancies import HhApiProvider


def test_hh_provider_is_disabled_by_default():
    with pytest.raises(RuntimeError, match="disabled"):
        HhApiProvider(Settings(hh_enabled=False))


def test_hh_requires_commercial_confirmation_and_contact():
    with pytest.raises(ValidationError, match="HH_ENABLED requires"):
        Settings(hh_enabled=True, hh_commercial_use_confirmed=False)
    with pytest.raises(ValidationError, match="HH_ENABLED requires"):
        Settings(
            hh_enabled=True,
            hh_commercial_use_confirmed=True,
            hh_contact_email="",
        )
