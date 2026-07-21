from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CurrencyRateSnapshot
from app.providers.currency import CbrCurrencyRateProvider

DEFAULT_CURRENCIES = ("USD", "EUR", "KZT")


def snapshot_currency_rates(
    db: Session,
    provider: CbrCurrencyRateProvider,
    *,
    on_date: date,
    currencies: tuple[str, ...] = DEFAULT_CURRENCIES,
) -> dict[str, object]:
    stored: list[dict[str, object]] = []
    for currency in currencies:
        quote = provider.quote_to_rub(currency, on_date)
        snapshot = db.scalar(
            select(CurrencyRateSnapshot).where(
                CurrencyRateSnapshot.provider == quote.provider,
                CurrencyRateSnapshot.currency == quote.currency,
                CurrencyRateSnapshot.requested_date == quote.requested_date,
            )
        )
        if snapshot is None:
            snapshot = CurrencyRateSnapshot(
                provider=quote.provider,
                currency=quote.currency,
                requested_date=quote.requested_date,
                effective_date=quote.effective_date,
                rate_to_rub=quote.rate_to_rub,
                source_url=quote.source_url,
            )
            db.add(snapshot)
        else:
            snapshot.effective_date = quote.effective_date
            snapshot.rate_to_rub = quote.rate_to_rub
            snapshot.source_url = quote.source_url
        stored.append(
            {
                "currency": quote.currency,
                "requested_date": quote.requested_date.isoformat(),
                "effective_date": quote.effective_date.isoformat(),
                "rate_to_rub": str(quote.rate_to_rub),
            }
        )
    db.commit()
    return {
        "status": "success",
        "provider": provider.name,
        "snapshot_count": len(stored),
        "snapshots": stored,
    }


def snapshot_configured_currency_rates(db: Session) -> dict[str, object]:
    if not settings.cbr_currency_enabled:
        return {"status": "skipped", "reason": "CBR_CURRENCY_ENABLED=false"}
    provider = CbrCurrencyRateProvider(
        base_url=settings.cbr_currency_base_url,
        timeout_seconds=settings.cbr_currency_timeout_seconds,
    )
    moscow_date = datetime.now(ZoneInfo("Europe/Moscow")).date()
    return snapshot_currency_rates(db, provider, on_date=moscow_date)
