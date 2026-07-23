import asyncio
import base64
import hashlib
import hmac
import json
from decimal import Decimal
from urllib.parse import parse_qs, unquote, urlencode, urlsplit

import httpx
import pytest

from app.providers.payments import (
    PaymentProviderError,
    ReceiptItem,
    RobokassaPaymentProvider,
    WebhookAuthenticationError,
    YooKassaPaymentProvider,
)

SERVICE_RECEIPT = ReceiptItem(
    name="Premium на 30 дней",
    payment_method="full_payment",
    payment_object="service",
    tax="none",
)


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
                receipt_item=SERVICE_RECEIPT,
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
                receipt_item=SERVICE_RECEIPT,
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


def robokassa_provider(
    handler=None, *, test_mode=True, fiscalization_mode="disabled"
):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler)) if handler else None
    return (
        RobokassaPaymentProvider(
            merchant_login="test-merchant",
            password1="password-one",
            password2="password-two",
            password3="password-three",
            hash_algorithm="sha256",
            payment_url="https://auth.robokassa.test/Merchant/Payment/Index",
            op_state_url="https://auth.robokassa.test/OpStateExt",
            refund_url="https://services.robokassa.test/Refund/Create",
            refund_state_url="https://services.robokassa.test/Refund/GetState",
            timeout_seconds=5,
            test_mode=test_mode,
            fiscalization_mode=fiscalization_mode,
            client=client,
        ),
        client,
    )


def test_robokassa_create_payment_signs_only_server_values():
    async def scenario():
        provider, _ = robokassa_provider()
        return await provider.create_payment(
            order_public_id="order-42",
            amount=Decimal("990.00"),
            currency="RUB",
            description="Premium на 30 дней",
            receipt_item=SERVICE_RECEIPT,
            customer_email="buyer@example.test",
            return_url="https://example.test/payments/return?order_id=order-42",
            idempotency_key="server-order-42",
            provider_reference="42",
        )

    payment = asyncio.run(scenario())
    query = parse_qs(urlsplit(payment.confirmation_url or "").query)
    fail_url = "https://example.test/payments/error?order_id=order-42"
    signature_base = ":".join(
        (
            "test-merchant",
            "990.00",
            "42",
            "https://example.test/payments/return?order_id=order-42",
            "GET",
            fail_url,
            "GET",
            "password-one",
            "Shp_order_id=order-42",
        )
    )
    expected = hashlib.sha256(signature_base.encode()).hexdigest()
    assert payment.external_id == "42"
    assert payment.amount == Decimal("990.00")
    assert query["OutSum"] == ["990.00"]
    assert query["InvId"] == ["42"]
    assert query["IsTest"] == ["1"]
    assert query["Shp_order_id"] == ["order-42"]
    assert query["SignatureValue"] == [expected]


def test_robokassa_receipt_is_server_built_and_included_in_signature():
    async def scenario():
        provider, _ = robokassa_provider(fiscalization_mode="robokassa")
        return await provider.create_payment(
            order_public_id="order-receipt",
            amount=Decimal("1200.00"),
            currency="RUB",
            description="Premium на 30 дней",
            receipt_item=SERVICE_RECEIPT,
            customer_email="buyer@example.test",
            return_url="https://example.test/payments/return?order_id=order-receipt",
            idempotency_key="server-order-receipt",
            provider_reference="84",
        )

    payment = asyncio.run(scenario())
    query = parse_qs(urlsplit(payment.confirmation_url or "").query)
    encoded_receipt = query["Receipt"][0]
    receipt = json.loads(unquote(encoded_receipt))
    assert receipt["items"] == [
        {
            "name": "Premium на 30 дней",
            "quantity": 1,
            "sum": 1200.0,
            "payment_method": "full_payment",
            "payment_object": "service",
            "tax": "none",
        }
    ]
    signature_base = ":".join(
        (
            "test-merchant",
            "1200.00",
            "84",
            encoded_receipt,
            "https://example.test/payments/return?order_id=order-receipt",
            "GET",
            "https://example.test/payments/error?order_id=order-receipt",
            "GET",
            "password-one",
            "Shp_order_id=order-receipt",
        )
    )
    assert query["SignatureValue"] == [hashlib.sha256(signature_base.encode()).hexdigest()]


def test_robokassa_result_url_signature_is_verified_and_acknowledged():
    values = {
        "OutSum": "990.00",
        "InvId": "42",
        "Shp_order_id": "order-42",
        "IsTest": "1",
    }
    signature_base = "990.00:42:password-two:Shp_order_id=order-42"
    values["SignatureValue"] = hashlib.sha256(signature_base.encode()).hexdigest()

    async def scenario(payload: dict[str, str]):
        provider, _ = robokassa_provider()
        return await provider.authenticate_webhook(urlencode(payload).encode(), {})

    verified = asyncio.run(scenario(values))
    assert verified.payment is not None
    assert verified.payment.status == "succeeded"
    assert verified.payment.order_public_id == "order-42"
    assert verified.acknowledgement == "OK42"

    with pytest.raises(WebhookAuthenticationError):
        asyncio.run(scenario({**values, "OutSum": "1.00"}))


def test_robokassa_live_refund_uses_op_state_and_signed_jwt():
    captured = {}

    def handler(request: httpx.Request):
        if request.url.path.endswith("/OpStateExt"):
            captured["op_state_query"] = dict(request.url.params)
            return httpx.Response(
                200,
                content=(
                    b'<OperationStateResponse xmlns="http://merchant.roboxchange.com/WebService/">'
                    b"<Result><Code>0</Code></Result><State><Code>100</Code></State>"
                    b"<Info><OutSum>990.00</OutSum><OpKey>operation-key</OpKey></Info>"
                    b"</OperationStateResponse>"
                ),
            )
        captured["refund_token"] = request.content.decode()
        return httpx.Response(
            200,
            json={"success": True, "message": None, "requestId": "refund-request-1"},
        )

    async def scenario():
        provider, client = robokassa_provider(
            handler, test_mode=False, fiscalization_mode="robokassa"
        )
        try:
            return await provider.create_refund(
                payment_external_id="42",
                amount=Decimal("990.00"),
                currency="RUB",
                description="Возврат Premium",
                receipt_item=SERVICE_RECEIPT,
                idempotency_key="refund-local-id",
            )
        finally:
            assert client is not None
            await client.aclose()

    refund = asyncio.run(scenario())
    expected_lookup = hashlib.sha256(b"test-merchant:42:password-two").hexdigest()
    assert captured["op_state_query"]["Signature"] == expected_lookup
    token = captured["refund_token"]
    header_segment, payload_segment, signature_segment = token.split(".")
    signing_input = f"{header_segment}.{payload_segment}"
    expected_signature = hmac.new(
        b"password-three", signing_input.encode(), hashlib.sha256
    ).digest()
    assert signature_segment == base64.urlsafe_b64encode(expected_signature).rstrip(b"=").decode()
    padded = payload_segment + "=" * (-len(payload_segment) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded))
    assert payload["OpKey"] == "operation-key"
    assert payload["InvoiceItems"][0]["Name"] == SERVICE_RECEIPT.name
    assert payload["InvoiceItems"][0]["Tax"] == "none"
    assert refund.external_id == "refund-request-1"
    assert refund.status == "pending"


def test_robokassa_test_refund_fails_closed_because_op_state_is_live_only():
    async def scenario():
        provider, _ = robokassa_provider(test_mode=True)
        await provider.create_refund(
            payment_external_id="42",
            amount=Decimal("990.00"),
            currency="RUB",
            description="Возврат",
            receipt_item=SERVICE_RECEIPT,
            idempotency_key="refund-local-id",
        )

    with pytest.raises(PaymentProviderError, match="cannot inspect test payments"):
        asyncio.run(scenario())
