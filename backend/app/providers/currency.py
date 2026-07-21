from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol
from xml.etree import ElementTree

import httpx

from app.config import settings


class CurrencyRateError(RuntimeError):
    pass


@dataclass(frozen=True)
class CurrencyRateQuote:
    currency: str
    requested_date: date
    effective_date: date
    rate_to_rub: Decimal
    provider: str
    source_url: str


class CurrencyRateProvider(Protocol):
    name: str

    def rate_to_rub(self, currency: str, on_date: date) -> Decimal: ...


class DemoCurrencyRateProvider:
    name = "demo-fixed-v1"
    _rates = {
        "RUB": Decimal("1"),
        "USD": Decimal("92.50"),
        "EUR": Decimal("100.20"),
        "KZT": Decimal("0.205"),
    }

    def rate_to_rub(self, currency: str, on_date: date) -> Decimal:
        del on_date
        try:
            return self._rates[currency.upper()]
        except KeyError as exc:
            raise ValueError(f"Unsupported demo currency: {currency}") from exc


class CbrCurrencyRateProvider:
    name = "cbr-xml-daily-v1"

    def __init__(
        self,
        base_url: str = "https://www.cbr.ru/scripts/XML_daily.asp",
        timeout_seconds: float = 15,
        client: httpx.Client | None = None,
    ) -> None:
        if not base_url.startswith("https://www.cbr.ru/"):
            raise ValueError("CBR currency URL must use the official HTTPS host")
        self.base_url = base_url
        self.timeout_seconds = timeout_seconds
        self.client = client

    def quote_to_rub(self, currency: str, on_date: date) -> CurrencyRateQuote:
        normalized_currency = currency.upper()
        if normalized_currency == "RUB":
            return CurrencyRateQuote(
                currency="RUB",
                requested_date=on_date,
                effective_date=on_date,
                rate_to_rub=Decimal("1"),
                provider=self.name,
                source_url=self.base_url,
            )
        params = {"date_req": on_date.strftime("%d/%m/%Y")}
        try:
            if self.client is None:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.get(self.base_url, params=params)
            else:
                response = self.client.get(self.base_url, params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise CurrencyRateError("CBR currency request failed") from exc
        return self._parse_quote(response.content, normalized_currency, on_date)

    def _parse_quote(
        self, payload: bytes, currency: str, requested_date: date
    ) -> CurrencyRateQuote:
        try:
            root = ElementTree.fromstring(payload)
            effective_date = datetime.strptime(root.attrib["Date"], "%d.%m.%Y").date()
        except (ElementTree.ParseError, KeyError, ValueError) as exc:
            raise CurrencyRateError("Invalid CBR currency response") from exc

        for item in root.findall("Valute"):
            if (item.findtext("CharCode") or "").upper() != currency:
                continue
            try:
                nominal = Decimal((item.findtext("Nominal") or "").replace(",", "."))
                value = Decimal((item.findtext("Value") or "").replace(",", "."))
                rate = value / nominal
            except (ArithmeticError, ValueError) as exc:
                raise CurrencyRateError(f"Invalid CBR rate for {currency}") from exc
            return CurrencyRateQuote(
                currency=currency,
                requested_date=requested_date,
                effective_date=effective_date,
                rate_to_rub=rate,
                provider=self.name,
                source_url=self.base_url,
            )
        raise CurrencyRateError(f"CBR rate is unavailable for {currency}")

    def rate_to_rub(self, currency: str, on_date: date) -> Decimal:
        return self.quote_to_rub(currency, on_date).rate_to_rub


def get_currency_rate_provider() -> CurrencyRateProvider:
    if settings.cbr_currency_enabled:
        return CbrCurrencyRateProvider(
            base_url=settings.cbr_currency_base_url,
            timeout_seconds=settings.cbr_currency_timeout_seconds,
        )
    return DemoCurrencyRateProvider()


def normalize_amount(
    amount: Decimal | None, currency: str, on_date: date, provider: CurrencyRateProvider
) -> Decimal | None:
    return (
        None
        if amount is None
        else (amount * provider.rate_to_rub(currency, on_date)).quantize(Decimal("0.01"))
    )
