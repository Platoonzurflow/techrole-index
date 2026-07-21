from __future__ import annotations

import hashlib
import hmac
import json
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Protocol

import httpx


class PaymentProviderError(RuntimeError):
    """The provider rejected a request or returned an invalid response."""


class WebhookAuthenticationError(PaymentProviderError):
    """A webhook could not be authenticated."""


@dataclass(frozen=True)
class ProviderPayment:
    external_id: str
    status: str
    amount: Decimal
    currency: str
    confirmation_url: str | None
    order_public_id: str
    is_test: bool


@dataclass(frozen=True)
class ProviderRefund:
    external_id: str
    payment_external_id: str
    status: str
    amount: Decimal
    currency: str


@dataclass(frozen=True)
class VerifiedWebhook:
    event_id: str
    event_type: str
    object_type: str
    payment: ProviderPayment | None = None
    refund: ProviderRefund | None = None


class PaymentProvider(Protocol):
    code: str

    async def create_payment(
        self,
        *,
        order_public_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        customer_email: str,
        return_url: str,
        idempotency_key: str,
    ) -> ProviderPayment: ...

    async def create_refund(
        self,
        *,
        payment_external_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        idempotency_key: str,
    ) -> ProviderRefund: ...

    async def authenticate_webhook(
        self, body: bytes, headers: Mapping[str, str]
    ) -> VerifiedWebhook: ...


def _decimal(value: object, field: str) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise PaymentProviderError(f"Invalid provider amount in {field}") from exc


def _json_object(body: bytes) -> dict:
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WebhookAuthenticationError("Invalid webhook JSON") from exc
    if not isinstance(payload, dict):
        raise WebhookAuthenticationError("Webhook body must be an object")
    return payload


def _required_str(value: object, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise PaymentProviderError(f"Provider response has an invalid {field}")
    return value


def _payment_from_object(payload: dict) -> ProviderPayment:
    amount = payload.get("amount")
    metadata = payload.get("metadata")
    if not isinstance(amount, dict) or not isinstance(metadata, dict):
        raise PaymentProviderError("Provider payment is missing amount or metadata")
    external_id = _required_str(payload.get("id"), "payment.id")
    status = _required_str(payload.get("status"), "payment.status")
    order_public_id = _required_str(metadata.get("order_id"), "payment.metadata.order_id")
    currency = _required_str(amount.get("currency"), "payment.amount.currency")
    confirmation = payload.get("confirmation")
    confirmation_url = None
    if isinstance(confirmation, dict) and isinstance(confirmation.get("confirmation_url"), str):
        confirmation_url = confirmation["confirmation_url"]
    return ProviderPayment(
        external_id=external_id,
        status=status,
        amount=_decimal(amount.get("value"), "payment.amount.value"),
        currency=currency,
        confirmation_url=confirmation_url,
        order_public_id=order_public_id,
        is_test=bool(payload.get("test", False)),
    )


def _refund_from_object(payload: dict) -> ProviderRefund:
    amount = payload.get("amount")
    if not isinstance(amount, dict):
        raise PaymentProviderError("Provider refund is missing amount")
    external_id = _required_str(payload.get("id"), "refund.id")
    payment_external_id = _required_str(payload.get("payment_id"), "refund.payment_id")
    status = _required_str(payload.get("status"), "refund.status")
    currency = _required_str(amount.get("currency"), "refund.amount.currency")
    return ProviderRefund(
        external_id=external_id,
        payment_external_id=payment_external_id,
        status=status,
        amount=_decimal(amount.get("value"), "refund.amount.value"),
        currency=currency,
    )


class DemoPaymentProvider:
    """An explicit local sandbox. It never sends or receives money."""

    code = "demo"

    def __init__(self, signing_secret: str, public_base_url: str = "http://localhost:3000"):
        self.signing_secret = signing_secret.encode()
        del public_base_url

    async def create_payment(
        self,
        *,
        order_public_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        customer_email: str,
        return_url: str,
        idempotency_key: str,
    ) -> ProviderPayment:
        del description, customer_email, return_url, idempotency_key
        return ProviderPayment(
            external_id=f"demo-pay-{order_public_id}",
            status="pending",
            amount=amount,
            currency=currency,
            confirmation_url=f"/payments/demo/{order_public_id}",
            order_public_id=order_public_id,
            is_test=True,
        )

    async def create_refund(
        self,
        *,
        payment_external_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        idempotency_key: str,
    ) -> ProviderRefund:
        del description
        return ProviderRefund(
            external_id=f"demo-refund-{idempotency_key}",
            payment_external_id=payment_external_id,
            status="succeeded",
            amount=amount,
            currency=currency,
        )

    def sign_webhook(self, payload: dict) -> tuple[bytes, str]:
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        signature = hmac.new(self.signing_secret, body, hashlib.sha256).hexdigest()
        return body, signature

    def verify_webhook(self, body: bytes, signature: str) -> bool:
        """Compatibility helper for callers that only need raw HMAC verification."""
        expected = hmac.new(self.signing_secret, body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def authenticate_webhook(
        self, body: bytes, headers: Mapping[str, str]
    ) -> VerifiedWebhook:
        signature = headers.get("x-demo-signature", "")
        if not self.verify_webhook(body, signature):
            raise WebhookAuthenticationError("Invalid demo webhook signature")
        payload = _json_object(body)
        event_id = payload.get("event_id")
        event_type = payload.get("event") or payload.get("type")
        resource = payload.get("object")
        if not isinstance(event_id, str) or not isinstance(event_type, str) or not isinstance(resource, dict):
            raise WebhookAuthenticationError("Invalid demo webhook envelope")
        if event_type.startswith("payment."):
            return VerifiedWebhook(
                event_id=event_id,
                event_type=event_type,
                object_type="payment",
                payment=_payment_from_object(resource),
            )
        if event_type.startswith("refund."):
            return VerifiedWebhook(
                event_id=event_id,
                event_type=event_type,
                object_type="refund",
                refund=_refund_from_object(resource),
            )
        raise WebhookAuthenticationError("Unsupported demo webhook event")


class YooKassaPaymentProvider:
    """Minimal official REST adapter; card data never reaches this application."""

    code = "yookassa"

    def __init__(
        self,
        *,
        shop_id: str,
        secret_key: str,
        api_url: str,
        timeout_seconds: float,
        test_mode: bool,
        fiscalization_mode: str = "disabled",
        vat_code: int = 0,
        client: httpx.AsyncClient | None = None,
    ):
        self.shop_id = shop_id
        self.secret_key = secret_key
        self.api_url = api_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.test_mode = test_mode
        self.fiscalization_mode = fiscalization_mode
        self.vat_code = vat_code
        self.client = client

    async def _request(
        self,
        method: str,
        path: str,
        *,
        idempotency_key: str | None = None,
        payload: dict | None = None,
    ) -> dict:
        headers = {"Accept": "application/json"}
        if idempotency_key:
            headers["Idempotence-Key"] = idempotency_key
        auth = httpx.BasicAuth(self.shop_id, self.secret_key)
        try:
            if self.client is not None:
                response = await self.client.request(
                    method,
                    f"{self.api_url}{path}",
                    auth=auth,
                    headers=headers,
                    json=payload,
                )
            else:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    response = await client.request(
                        method,
                        f"{self.api_url}{path}",
                        auth=auth,
                        headers=headers,
                        json=payload,
                    )
            response.raise_for_status()
            result = response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise PaymentProviderError("YooKassa API request failed") from exc
        if not isinstance(result, dict):
            raise PaymentProviderError("YooKassa returned a non-object response")
        return result

    async def create_payment(
        self,
        *,
        order_public_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        customer_email: str,
        return_url: str,
        idempotency_key: str,
    ) -> ProviderPayment:
        payload = {
            "amount": {"value": f"{amount:.2f}", "currency": currency},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "description": description,
            "metadata": {"order_id": order_public_id},
        }
        if self.fiscalization_mode in {"yookassa", "third_party"}:
            if self.vat_code == 0:
                raise PaymentProviderError("A VAT code is required for receipt fiscalization")
            payload["receipt"] = {
                "customer": {"email": customer_email},
                "items": [
                    {
                        "description": description,
                        "quantity": "1.000",
                        "amount": {"value": f"{amount:.2f}", "currency": currency},
                        "vat_code": self.vat_code,
                        "payment_mode": "full_payment",
                        "payment_subject": "service",
                    }
                ],
            }
        return _payment_from_object(
            await self._request(
                "POST", "/payments", idempotency_key=idempotency_key, payload=payload
            )
        )

    async def get_payment(self, external_id: str) -> ProviderPayment:
        return _payment_from_object(await self._request("GET", f"/payments/{external_id}"))

    async def create_refund(
        self,
        *,
        payment_external_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        idempotency_key: str,
    ) -> ProviderRefund:
        payload = {
            "payment_id": payment_external_id,
            "amount": {"value": f"{amount:.2f}", "currency": currency},
            "description": description,
        }
        return _refund_from_object(
            await self._request(
                "POST", "/refunds", idempotency_key=idempotency_key, payload=payload
            )
        )

    async def get_refund(self, external_id: str) -> ProviderRefund:
        return _refund_from_object(await self._request("GET", f"/refunds/{external_id}"))

    async def authenticate_webhook(
        self, body: bytes, headers: Mapping[str, str]
    ) -> VerifiedWebhook:
        del headers
        payload = _json_object(body)
        event_type = payload.get("event")
        resource = payload.get("object")
        if not isinstance(event_type, str) or not isinstance(resource, dict):
            raise WebhookAuthenticationError("Invalid YooKassa webhook envelope")
        external_id = resource.get("id")
        if not isinstance(external_id, str) or not external_id:
            raise WebhookAuthenticationError("YooKassa webhook is missing an object id")

        # YooKassa does not sign notifications. The official authenticity check is an
        # authenticated GET of the current object (optionally combined with IP filtering).
        if event_type.startswith("payment."):
            payment = await self.get_payment(external_id)
            if payment.is_test != self.test_mode:
                raise WebhookAuthenticationError("YooKassa test/live mode mismatch")
            return VerifiedWebhook(
                event_id=f"{event_type}:{payment.external_id}:{payment.status}",
                event_type=event_type,
                object_type="payment",
                payment=payment,
            )
        if event_type.startswith("refund."):
            refund = await self.get_refund(external_id)
            return VerifiedWebhook(
                event_id=f"{event_type}:{refund.external_id}:{refund.status}",
                event_type=event_type,
                object_type="refund",
                refund=refund,
            )
        raise WebhookAuthenticationError("Unsupported YooKassa webhook event")
