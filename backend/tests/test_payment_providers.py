import asyncio
import json
from decimal import Decimal

import httpx
import pytest

from app.providers.payments import WebhookAuthenticationError, YooKassaPaymentProvider


def provider_with(handler, *, test_mode=True, fiscalization_mode="disabled", vat_code=0):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return (
        YooKassaPaymentProvider(
            shop_id="test-shop",
            secret_key="test-secret",
            api_url="https://api.yookassa.test/v3",
            timeout_seconds=5,
            test_mode=test_mode,
            fiscalization_mode=fiscalization_mode,
            vat_code=vat_code,
            client=client,
        ),
        client,
    )


def test_yookassa_create_payment_uses_server_values_and_idempotency():
    captured = {}

    def handler(request: httpx.Request):
        captured["headers"] = request.headers
        captured["payload"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "yk-payment-1",
                "status": "pending",
                "amount": {"value": "1.00", "currency": "RUB"},
                "confirmation": {
                    "type": "redirect",
                    "confirmation_url": "https://yoomoney.test/checkout/1",
                },
                "metadata": {"order_id": "order-1"},
                "test": True,
            },
        )

    async def scenario():
        provider, client = provider_with(handler)
        try:
            payment = await provider.create_payment(
                order_public_id="order-1",
                amount=Decimal("1.00"),
                currency="RUB",
                description="Premium на 30 дней",
                customer_email="buyer@example.test",
                return_url="https://example.test/payments/return?order_id=order-1",
                idempotency_key="server-order-1",
            )
        finally:
            await client.aclose()
        return payment

    payment = asyncio.run(scenario())
    assert payment.external_id == "yk-payment-1"
    assert captured["headers"]["Idempotence-Key"] == "server-order-1"
    assert captured["headers"]["Authorization"].startswith("Basic ")
    assert captured["payload"]["amount"] == {"value": "1.00", "currency": "RUB"}
    assert captured["payload"]["metadata"] == {"order_id": "order-1"}
    assert captured["payload"]["capture"] is True
    assert "receipt" not in captured["payload"]


def test_yookassa_receipt_is_built_from_server_product_and_user_email():
    captured = {}

    def handler(request: httpx.Request):
        captured["payload"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "yk-payment-receipt",
                "status": "pending",
                "amount": {"value": "990.00", "currency": "RUB"},
                "metadata": {"order_id": "order-receipt"},
                "test": True,
            },
        )

    async def scenario():
        provider, client = provider_with(
            handler, fiscalization_mode="yookassa", vat_code=1
        )
        try:
            await provider.create_payment(
                order_public_id="order-receipt",
                amount=Decimal("990.00"),
                currency="RUB",
                description="Premium на 30 дней",
                customer_email="buyer@example.test",
                return_url="https://example.test/payments/return?order_id=order-receipt",
                idempotency_key="server-order-receipt",
            )
        finally:
            await client.aclose()

    asyncio.run(scenario())
    assert captured["payload"]["receipt"] == {
        "customer": {"email": "buyer@example.test"},
        "items": [
            {
                "description": "Premium на 30 дней",
                "quantity": "1.000",
                "amount": {"value": "990.00", "currency": "RUB"},
                "vat_code": 1,
                "payment_mode": "full_payment",
                "payment_subject": "service",
            }
        ],
    }


def test_yookassa_webhook_is_authenticated_by_api_refetch():
    calls = []

    def handler(request: httpx.Request):
        calls.append(str(request.url))
        return httpx.Response(
            200,
            json={
                "id": "yk-payment-2",
                "status": "succeeded",
                "amount": {"value": "1.00", "currency": "RUB"},
                "metadata": {"order_id": "order-2"},
                "test": True,
            },
        )

    async def scenario():
        provider, client = provider_with(handler)
        try:
            return await provider.authenticate_webhook(
                json.dumps(
                    {
                        "type": "notification",
                        "event": "payment.succeeded",
                        "object": {"id": "yk-payment-2", "status": "pending"},
                    }
                ).encode(),
                {},
            )
        finally:
            await client.aclose()

    verified = asyncio.run(scenario())
    assert calls == ["https://api.yookassa.test/v3/payments/yk-payment-2"]
    assert verified.payment is not None
    assert verified.payment.status == "succeeded"
    assert verified.event_id == "payment.succeeded:yk-payment-2:succeeded"


def test_yookassa_webhook_rejects_test_live_mismatch():
    def handler(request: httpx.Request):
        del request
        return httpx.Response(
            200,
            json={
                "id": "yk-payment-live",
                "status": "succeeded",
                "amount": {"value": "1.00", "currency": "RUB"},
                "metadata": {"order_id": "order-live"},
                "test": False,
            },
        )

    async def scenario():
        provider, client = provider_with(handler, test_mode=True)
        try:
            await provider.authenticate_webhook(
                b'{"event":"payment.succeeded","object":{"id":"yk-payment-live"}}',
                {},
            )
        finally:
            await client.aclose()

    with pytest.raises(WebhookAuthenticationError):
        asyncio.run(scenario())
