import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Base, Entitlement, PaymentOrder, PaymentRefund, User
from app.providers.payments import RobokassaPaymentProvider
from app.services import payments as payment_service


def test_pending_robokassa_refund_is_reconciled_once(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "requestId": request.url.params["id"],
                    "amount": 990.0,
                    "label": "finished",
                },
            )
        )
    )
    provider = RobokassaPaymentProvider(
        merchant_login="merchant",
        password1="password-one",
        password2="password-two",
        password3="password-three",
        hash_algorithm="sha256",
        payment_url="https://auth.robokassa.test/pay",
        op_state_url="https://auth.robokassa.test/state",
        refund_url="https://services.robokassa.test/refund",
        refund_state_url="https://services.robokassa.test/refund-state",
        timeout_seconds=5,
        test_mode=False,
        fiscalization_mode="robokassa",
        client=client,
    )
    monkeypatch.setattr(settings, "payments_enabled", True)
    monkeypatch.setattr(settings, "payments_provider", "robokassa")
    monkeypatch.setattr(settings, "payments_mode", "live")
    monkeypatch.setattr(payment_service, "get_payment_provider", lambda: provider)

    with Session(engine) as db:
        user = User(
            email="buyer@example.test",
            display_name="Buyer",
            password_hash="not-used-in-this-test",
        )
        db.add(user)
        db.flush()
        now = datetime.now(timezone.utc)
        order = PaymentOrder(
            public_id="11111111-1111-1111-1111-111111111111",
            user_id=user.id,
            product_code="premium_30_days",
            provider="robokassa",
            external_payment_id="42",
            client_idempotency_key="checkout-key-0001",
            status="succeeded",
            amount=Decimal("990.00"),
            currency="RUB",
            description="Доступ TechRole Index Premium на 30 дней",
            terms_version="offer-test",
            terms_accepted_at=now,
            is_test=False,
            paid_at=now,
        )
        db.add(order)
        db.flush()
        local_refund = PaymentRefund(
            public_id="22222222-2222-2222-2222-222222222222",
            payment_order_id=order.id,
            provider="robokassa",
            external_refund_id="refund-request-1",
            idempotency_key="refund-key-0001",
            status="pending",
            amount=Decimal("990.00"),
            currency="RUB",
            reason="customer_request",
        )
        entitlement = Entitlement(
            user_id=user.id,
            code="premium",
            source=f"payment:{order.public_id}",
            starts_at=now,
            ends_at=now + timedelta(days=30),
        )
        db.add_all((local_refund, entitlement))
        db.commit()

        first = asyncio.run(payment_service.reconcile_pending_refunds(db))
        second = asyncio.run(payment_service.reconcile_pending_refunds(db))
        db.expire_all()
        assert first == {"checked": 1, "updated": 1, "failed": 0}
        assert second == {"checked": 0, "updated": 0, "failed": 0}
        assert db.scalar(select(PaymentRefund)).status == "succeeded"
        assert db.scalar(select(PaymentOrder)).status == "refunded"
        assert db.scalar(select(Entitlement)).revoked_at is not None

    asyncio.run(client.aclose())
    engine.dispose()
