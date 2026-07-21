from datetime import date
from decimal import Decimal

import httpx
import pytest

from app.providers.currency import (
    CbrCurrencyRateProvider,
    CurrencyRateError,
    DemoCurrencyRateProvider,
    normalize_amount,
)

CBR_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<ValCurs Date="17.07.2026" name="Foreign Currency Market">
  <Valute ID="R01235"><CharCode>USD</CharCode><Nominal>1</Nominal><Value>80,5000</Value></Valute>
  <Valute ID="R01335"><CharCode>KZT</CharCode><Nominal>100</Nominal><Value>20,5000</Value></Valute>
</ValCurs>
"""


def test_deterministic_currency_normalization():
    provider = DemoCurrencyRateProvider()
    assert normalize_amount(Decimal("100"), "USD", date(2026, 7, 17), provider) == Decimal(
        "9250.00"
    )
    assert normalize_amount(None, "EUR", date(2026, 7, 17), provider) is None
    assert provider.rate_to_rub("USD", date(2020, 1, 1)) == provider.rate_to_rub(
        "USD", date(2030, 1, 1)
    )


def test_unknown_currency_is_explicit_error():
    with pytest.raises(ValueError, match="Unsupported"):
        DemoCurrencyRateProvider().rate_to_rub("BTC", date.today())


def test_cbr_provider_uses_effective_date_and_nominal() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["date_req"] == "18/07/2026"
        return httpx.Response(200, content=CBR_XML)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        provider = CbrCurrencyRateProvider(client=client)
        quote = provider.quote_to_rub("KZT", date(2026, 7, 18))

    assert quote.requested_date == date(2026, 7, 18)
    assert quote.effective_date == date(2026, 7, 17)
    assert quote.rate_to_rub == Decimal("0.2050")
    assert quote.provider == "cbr-xml-daily-v1"


def test_cbr_provider_rejects_missing_currency_and_unofficial_host() -> None:
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=CBR_XML))) as client:
        provider = CbrCurrencyRateProvider(client=client)
        with pytest.raises(CurrencyRateError, match="unavailable"):
            provider.rate_to_rub("BTC", date(2026, 7, 18))

    with pytest.raises(ValueError, match="official HTTPS host"):
        CbrCurrencyRateProvider(base_url="https://rates.example.com/daily.xml")
