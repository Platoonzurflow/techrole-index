from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import Base, CurrencyRateSnapshot
from app.providers.currency import CbrCurrencyRateProvider
from app.services.currency_rates import snapshot_currency_rates

CBR_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<ValCurs Date="17.07.2026">
  <Valute><CharCode>USD</CharCode><Nominal>1</Nominal><Value>80,5000</Value></Valute>
  <Valute><CharCode>EUR</CharCode><Nominal>1</Nominal><Value>93,1000</Value></Valute>
  <Valute><CharCode>KZT</CharCode><Nominal>100</Nominal><Value>20,5000</Value></Valute>
</ValCurs>
"""


def test_currency_snapshots_are_persisted_idempotently() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    client = httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=CBR_XML))
    )
    provider = CbrCurrencyRateProvider(client=client)

    with Session(engine) as db:
        first = snapshot_currency_rates(db, provider, on_date=date(2026, 7, 18))
        second = snapshot_currency_rates(db, provider, on_date=date(2026, 7, 18))
        count = db.scalar(select(func.count()).select_from(CurrencyRateSnapshot))
        usd = db.scalar(
            select(CurrencyRateSnapshot).where(CurrencyRateSnapshot.currency == "USD")
        )

    client.close()
    engine.dispose()
    assert first["snapshot_count"] == 3
    assert second["snapshot_count"] == 3
    assert count == 3
    assert usd is not None
    assert usd.requested_date == date(2026, 7, 18)
    assert usd.effective_date == date(2026, 7, 17)
    assert usd.rate_to_rub == Decimal("80.50000000")
