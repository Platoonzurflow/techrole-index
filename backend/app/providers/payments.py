import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol


@dataclass(frozen=True)
class PaymentResult:
    external_id: str
    status: str
    period_end: datetime


class PaymentProvider(Protocol):
    code: str

    def purchase(self, user_id: int) -> PaymentResult: ...
    def verify_webhook(self, body: bytes, signature: str) -> bool: ...


class DemoPaymentProvider:
    code = "demo"

    def __init__(self, signing_secret: str):
        self.signing_secret = signing_secret.encode()

    def purchase(self, user_id: int) -> PaymentResult:
        now = datetime.now(timezone.utc)
        return PaymentResult(f"demo-sub-{user_id}", "active", now + timedelta(days=30))

    def sign_webhook(self, payload: dict) -> tuple[bytes, str]:
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        signature = hmac.new(self.signing_secret, body, hashlib.sha256).hexdigest()
        return body, signature

    def verify_webhook(self, body: bytes, signature: str) -> bool:
        expected = hmac.new(self.signing_secret, body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
