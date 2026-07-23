from __future__ import annotations

import hashlib
import hmac
import json
from base64 import urlsafe_b64encode
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Protocol
from urllib.parse import parse_qs, quote, urlencode, urlsplit, urlunsplit
from xml.etree import ElementTree

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
class ReceiptItem:
    name: str
    payment_method: str
    payment_object: str
    tax: str


@dataclass(frozen=True)
class VerifiedWebhook:
    event_id: str
    event_type: str
    object_type: str
    payment: ProviderPayment | None = None
    refund: ProviderRefund | None = None
    acknowledgement: str | None = None


class PaymentProvider(Protocol):
    code: str

    async def create_payment(
        self,
        *,
        order_public_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        receipt_item: ReceiptItem,
        customer_email: str,
        return_url: str,
        idempotency_key: str,
        provider_reference: str | None = None,
    ) -> ProviderPayment: ...

    async def create_refund(
        self,
        *,
        payment_external_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        receipt_item: ReceiptItem,
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
        receipt_item: ReceiptItem,
        customer_email: str,
        return_url: str,
        idempotency_key: str,
        provider_reference: str | None = None,
    ) -> ProviderPayment:
        del (
            description,
            receipt_item,
            customer_email,
            return_url,
            idempotency_key,
            provider_reference,
        )
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
        receipt_item: ReceiptItem,
        idempotency_key: str,
    ) -> ProviderRefund:
        del description, receipt_item
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
        receipt_item: ReceiptItem,
        customer_email: str,
        return_url: str,
        idempotency_key: str,
        provider_reference: str | None = None,
    ) -> ProviderPayment:
        del provider_reference
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
                        "description": receipt_item.name,
                        "quantity": "1.000",
                        "amount": {"value": f"{amount:.2f}", "currency": currency},
                        "vat_code": self.vat_code,
                        "payment_mode": receipt_item.payment_method,
                        "payment_subject": receipt_item.payment_object,
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
        receipt_item: ReceiptItem,
        idempotency_key: str,
    ) -> ProviderRefund:
        del receipt_item
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


def _hash_hex(algorithm: str, value: str) -> str:
    try:
        digest = hashlib.new(algorithm.lower())
    except ValueError as exc:
        raise PaymentProviderError("Unsupported Robokassa hash algorithm") from exc
    digest.update(value.encode("utf-8"))
    return digest.hexdigest()


def _base64url(value: bytes) -> str:
    return urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _jwt_hs256(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_segment = _base64url(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_segment = _base64url(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )
    signing_input = f"{header_segment}.{payload_segment}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_base64url(signature)}"


class RobokassaPaymentProvider:
    """Signed Robokassa redirect/ResultURL adapter for Russian merchants."""

    code = "robokassa"

    def __init__(
        self,
        *,
        merchant_login: str,
        password1: str,
        password2: str,
        password3: str,
        hash_algorithm: str,
        payment_url: str,
        op_state_url: str,
        refund_url: str,
        refund_state_url: str,
        timeout_seconds: float,
        test_mode: bool,
        fiscalization_mode: str = "disabled",
        client: httpx.AsyncClient | None = None,
    ):
        self.merchant_login = merchant_login
        self.password1 = password1
        self.password2 = password2
        self.password3 = password3
        self.hash_algorithm = hash_algorithm.lower()
        self.payment_url = payment_url
        self.op_state_url = op_state_url
        self.refund_url = refund_url
        self.refund_state_url = refund_state_url
        self.timeout_seconds = timeout_seconds
        self.test_mode = test_mode
        self.fiscalization_mode = fiscalization_mode
        self.client = client

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        try:
            if self.client is not None:
                response = await self.client.request(method, url, **kwargs)
            else:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    response = await client.request(method, url, **kwargs)
            response.raise_for_status()
            return response
        except httpx.HTTPError as exc:
            raise PaymentProviderError("Robokassa API request failed") from exc

    def _receipt(self, *, receipt_item: ReceiptItem, amount: Decimal) -> str | None:
        if self.fiscalization_mode != "robokassa":
            return None
        receipt = {
            "items": [
                {
                    "name": receipt_item.name[:128],
                    "quantity": 1,
                    "sum": float(amount),
                    "payment_method": receipt_item.payment_method,
                    "payment_object": receipt_item.payment_object,
                    "tax": receipt_item.tax,
                }
            ]
        }
        raw = json.dumps(receipt, ensure_ascii=False, separators=(",", ":"))
        return quote(raw, safe="")

    async def create_payment(
        self,
        *,
        order_public_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        receipt_item: ReceiptItem,
        customer_email: str,
        return_url: str,
        idempotency_key: str,
        provider_reference: str | None = None,
    ) -> ProviderPayment:
        del idempotency_key
        if currency != "RUB":
            raise PaymentProviderError("Robokassa adapter accepts only RUB")
        if provider_reference is None or not provider_reference.isdigit():
            raise PaymentProviderError("Robokassa requires a numeric provider reference")
        invoice_id = str(int(provider_reference))
        if invoice_id == "0" or int(invoice_id) > 9_223_372_036_854_775_807:
            raise PaymentProviderError("Robokassa invoice id is out of range")

        parsed_return = urlsplit(return_url)
        fail_url = urlunsplit(
            (parsed_return.scheme, parsed_return.netloc, "/payments/error", parsed_return.query, "")
        )
        out_sum = f"{amount:.2f}"
        receipt = self._receipt(receipt_item=receipt_item, amount=amount)
        modifiers: list[str] = []
        if receipt is not None:
            modifiers.append(receipt)
        modifiers.extend((return_url, "GET", fail_url, "GET"))
        custom = {"Shp_order_id": order_public_id}
        signature_parts = [
            self.merchant_login,
            out_sum,
            invoice_id,
            *modifiers,
            self.password1,
            *(f"{key}={custom[key]}" for key in sorted(custom)),
        ]
        signature = _hash_hex(self.hash_algorithm, ":".join(signature_parts))
        params = {
            "MerchantLogin": self.merchant_login,
            "OutSum": out_sum,
            "InvId": invoice_id,
            "Description": description[:100],
            "Email": customer_email,
            "Culture": "ru",
            "Encoding": "utf-8",
            "IsTest": "1" if self.test_mode else "0",
            "SuccessUrl2": return_url,
            "SuccessUrl2Method": "GET",
            "FailUrl2": fail_url,
            "FailUrl2Method": "GET",
            "SignatureValue": signature,
            **custom,
        }
        if receipt is not None:
            params["Receipt"] = receipt
        confirmation_url = f"{self.payment_url}?{urlencode(params, quote_via=quote)}"
        return ProviderPayment(
            external_id=invoice_id,
            status="pending",
            amount=amount,
            currency=currency,
            confirmation_url=confirmation_url,
            order_public_id=order_public_id,
            is_test=self.test_mode,
        )

    async def authenticate_webhook(
        self, body: bytes, headers: Mapping[str, str]
    ) -> VerifiedWebhook:
        del headers
        try:
            decoded = body.decode("utf-8")
            parsed = parse_qs(decoded, keep_blank_values=True, strict_parsing=True)
        except (UnicodeDecodeError, ValueError) as exc:
            raise WebhookAuthenticationError("Invalid Robokassa ResultURL body") from exc
        if any(len(values) != 1 for values in parsed.values()):
            raise WebhookAuthenticationError("Duplicate Robokassa ResultURL parameter")
        params = {key: values[0] for key, values in parsed.items()}

        def value(name: str, *, required: bool = True) -> str | None:
            matches = [item for key, item in params.items() if key.casefold() == name.casefold()]
            if len(matches) > 1 or (required and (not matches or not matches[0])):
                raise WebhookAuthenticationError(f"Invalid Robokassa {name}")
            return matches[0] if matches else None

        out_sum = value("OutSum")
        invoice_id = value("InvId")
        signature = value("SignatureValue")
        order_public_id = value("Shp_order_id")
        assert out_sum is not None
        assert invoice_id is not None
        assert signature is not None
        assert order_public_id is not None
        custom = {key: item for key, item in params.items() if key.startswith("Shp_")}
        signature_parts = [
            out_sum,
            invoice_id,
            self.password2,
            *(f"{key}={custom[key]}" for key in sorted(custom)),
        ]
        expected = _hash_hex(self.hash_algorithm, ":".join(signature_parts))
        if not hmac.compare_digest(expected.casefold(), signature.casefold()):
            raise WebhookAuthenticationError("Invalid Robokassa ResultURL signature")

        test_value = value("IsTest", required=False)
        if self.test_mode and test_value != "1":
            raise WebhookAuthenticationError("Robokassa test/live mode mismatch")
        if not self.test_mode and test_value == "1":
            raise WebhookAuthenticationError("Robokassa test/live mode mismatch")
        payment = ProviderPayment(
            external_id=invoice_id,
            status="succeeded",
            amount=_decimal(out_sum, "payment.OutSum"),
            currency="RUB",
            confirmation_url=None,
            order_public_id=order_public_id,
            is_test=self.test_mode,
        )
        return VerifiedWebhook(
            event_id=f"payment.succeeded:{invoice_id}",
            event_type="payment.succeeded",
            object_type="payment",
            payment=payment,
            acknowledgement=f"OK{invoice_id}",
        )

    async def _operation_key(self, invoice_id: str) -> str:
        if self.test_mode:
            raise PaymentProviderError(
                "Robokassa OpStateExt cannot inspect test payments; use the demo refund sandbox"
            )
        signature = _hash_hex(
            self.hash_algorithm,
            f"{self.merchant_login}:{invoice_id}:{self.password2}",
        )
        response = await self._request(
            "GET",
            self.op_state_url,
            params={
                "MerchantLogin": self.merchant_login,
                "InvoiceID": invoice_id,
                "Signature": signature,
            },
        )
        try:
            root = ElementTree.fromstring(response.content)
        except ElementTree.ParseError as exc:
            raise PaymentProviderError("Invalid Robokassa OpStateExt XML") from exc

        def xml_text(name: str) -> str | None:
            for element in root.iter():
                if element.tag.rsplit("}", 1)[-1] == name and element.text:
                    return element.text.strip()
            return None

        if xml_text("Code") != "0":
            raise PaymentProviderError("Robokassa operation lookup failed")
        state = next(
            (
                element
                for element in root.iter()
                if element.tag.rsplit("}", 1)[-1] == "State"
            ),
            None,
        )
        state_code = None
        if state is not None:
            state_code = next(
                (
                    element.text.strip()
                    for element in state
                    if element.tag.rsplit("}", 1)[-1] == "Code" and element.text
                ),
                None,
            )
        if state_code != "100":
            raise PaymentProviderError("Robokassa payment is not settled")
        operation_key = xml_text("OpKey")
        if not operation_key:
            raise PaymentProviderError("Robokassa operation key is missing")
        return operation_key

    async def create_refund(
        self,
        *,
        payment_external_id: str,
        amount: Decimal,
        currency: str,
        description: str,
        receipt_item: ReceiptItem,
        idempotency_key: str,
    ) -> ProviderRefund:
        del idempotency_key
        if currency != "RUB" or not self.password3:
            raise PaymentProviderError("Robokassa refund configuration is incomplete")
        operation_key = await self._operation_key(payment_external_id)
        payload: dict[str, object] = {"OpKey": operation_key}
        if self.fiscalization_mode == "robokassa":
            payload["InvoiceItems"] = [
                {
                    "Name": receipt_item.name[:128],
                    "Quantity": 1,
                    "Cost": float(amount),
                    "Tax": receipt_item.tax,
                    "PaymentMethod": receipt_item.payment_method,
                    "PaymentObject": receipt_item.payment_object,
                }
            ]
        token = _jwt_hs256(payload, self.password3)
        response = await self._request(
            "POST",
            self.refund_url,
            content=token.encode(),
            headers={"Accept": "application/json", "Content-Type": "application/jwt"},
        )
        try:
            result = response.json()
        except json.JSONDecodeError as exc:
            raise PaymentProviderError("Invalid Robokassa refund response") from exc
        if not isinstance(result, dict) or result.get("success") is not True:
            raise PaymentProviderError("Robokassa refund was rejected")
        request_id = _required_str(result.get("requestId"), "refund.requestId")
        return ProviderRefund(
            external_id=request_id,
            payment_external_id=payment_external_id,
            status="pending",
            amount=amount,
            currency=currency,
        )

    async def get_refund(
        self,
        *,
        request_id: str,
        payment_external_id: str,
        amount: Decimal,
        currency: str,
    ) -> ProviderRefund:
        response = await self._request("GET", self.refund_state_url, params={"id": request_id})
        try:
            result = response.json()
        except json.JSONDecodeError as exc:
            raise PaymentProviderError("Invalid Robokassa refund status response") from exc
        if not isinstance(result, dict) or result.get("requestId") != request_id:
            raise PaymentProviderError("Robokassa refund status lookup failed")
        label = result.get("label")
        if not isinstance(label, str):
            raise PaymentProviderError("Unknown Robokassa refund status")
        status = {
            "finished": "succeeded",
            "processing": "pending",
            "canceled": "canceled",
        }.get(label)
        if status is None:
            raise PaymentProviderError("Unknown Robokassa refund status")
        provider_amount = _decimal(result.get("amount"), "refund.amount")
        if provider_amount != amount:
            raise PaymentProviderError("Robokassa refund amount mismatch")
        return ProviderRefund(
            external_id=request_id,
            payment_external_id=payment_external_id,
            status=status,
            amount=provider_amount,
            currency=currency,
        )
