from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import urlsplit
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Entitlement,
    PaymentEvent,
    PaymentOrder,
    PaymentRefund,
    Subscription,
    User,
)
from app.providers.payments import (
    DemoPaymentProvider,
    PaymentProvider,
    PaymentProviderError,
    ProviderPayment,
    ProviderRefund,
    ReceiptItem,
    RobokassaPaymentProvider,
    VerifiedWebhook,
    YooKassaPaymentProvider,
)


class PaymentConfigurationError(RuntimeError):
    pass


class PaymentValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Product:
    code: str
    name: str
    description: str
    amount: Decimal
    currency: str
    access_days: int
    service_result: str
    fulfillment_code: str
    entitlement_code: str
    receipt_item: ReceiptItem
    refund_policy_path: str


@dataclass(frozen=True)
class ProductDefinition:
    name: str
    description: str
    amount_setting: str
    currency: str
    access_days: int
    service_result: str
    fulfillment_code: str
    entitlement_code: str
    receipt_item: ReceiptItem
    refund_policy_path: str


@dataclass(frozen=True)
class WebhookProcessResult:
    status: str
    acknowledgement: str | None = None


PRODUCT_CATALOG = {
    "premium_30_days": ProductDefinition(
        name="Premium на 30 дней",
        description="Полный доступ к аналитике TechRole Index на 30 календарных дней",
        amount_setting="premium_30_days_price_rub",
        currency="RUB",
        access_days=30,
        service_result=(
            "Premium-доступ включается после подтверждения оплаты и действует "
            "30 календарных дней; при продлении срок прибавляется к активному доступу."
        ),
        fulfillment_code="premium_entitlement",
        entitlement_code="premium",
        receipt_item=ReceiptItem(
            name="Доступ к сервису TechRole Index Premium на 30 дней",
            payment_method="full_payment",
            payment_object="service",
            tax="none",
        ),
        refund_policy_path="/legal/refunds",
    ),
}
PRODUCT_CODES = tuple(PRODUCT_CATALOG)


def get_product(code: str) -> Product:
    definition = PRODUCT_CATALOG.get(code)
    if definition is None:
        raise PaymentValidationError("Unknown product")
    return Product(
        code=code,
        name=definition.name,
        description=definition.description,
        amount=Decimal(str(getattr(settings, definition.amount_setting))).quantize(Decimal("0.01")),
        currency=definition.currency,
        access_days=definition.access_days,
        service_result=definition.service_result,
        fulfillment_code=definition.fulfillment_code,
        entitlement_code=definition.entitlement_code,
        receipt_item=definition.receipt_item,
        refund_policy_path=definition.refund_policy_path,
    )


def _product_snapshot(product: Product) -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "code": product.code,
        "name": product.name,
        "description": product.description,
        "amount": f"{product.amount:.2f}",
        "currency": product.currency,
        "access_days": product.access_days,
        "service_result": product.service_result,
        "fulfillment_code": product.fulfillment_code,
        "entitlement_code": product.entitlement_code,
        "receipt": {
            "name": product.receipt_item.name,
            "payment_method": product.receipt_item.payment_method,
            "payment_object": product.receipt_item.payment_object,
            "tax": product.receipt_item.tax,
        },
        "refund_policy_path": product.refund_policy_path,
    }


def order_product(order: PaymentOrder) -> Product:
    """Return the immutable product definition captured when the order was created."""
    snapshot = order.product_snapshot or {}
    if not snapshot:
        return get_product(order.product_code)
    try:
        receipt = snapshot["receipt"]
        if not isinstance(receipt, dict):
            raise TypeError
        product = Product(
            code=str(snapshot["code"]),
            name=str(snapshot["name"]),
            description=str(snapshot["description"]),
            amount=Decimal(str(snapshot["amount"])).quantize(Decimal("0.01")),
            currency=str(snapshot["currency"]),
            access_days=int(snapshot["access_days"]),
            service_result=str(snapshot["service_result"]),
            fulfillment_code=str(snapshot["fulfillment_code"]),
            entitlement_code=str(snapshot["entitlement_code"]),
            receipt_item=ReceiptItem(
                name=str(receipt["name"]),
                payment_method=str(receipt["payment_method"]),
                payment_object=str(receipt["payment_object"]),
                tax=str(receipt["tax"]),
            ),
            refund_policy_path=str(snapshot["refund_policy_path"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise PaymentConfigurationError("Stored product definition is invalid") from exc
    if (
        product.code != order.product_code
        or product.amount != order.amount
        or product.currency != order.currency
        or product.access_days <= 0
    ):
        raise PaymentConfigurationError("Stored product definition does not match the order")
    return product


def get_payment_provider() -> PaymentProvider:
    if settings.payments_provider == "demo":
        return DemoPaymentProvider(settings.app_secret_key, settings.public_base_url)
    if settings.payments_provider == "yookassa":
        return YooKassaPaymentProvider(
            shop_id=settings.yookassa_shop_id,
            secret_key=settings.yookassa_secret_key,
            api_url=settings.yookassa_api_url,
            timeout_seconds=settings.yookassa_timeout_seconds,
            test_mode=settings.payments_mode == "test",
            fiscalization_mode=settings.payments_fiscalization_mode,
            vat_code=settings.yookassa_vat_code,
        )
    if settings.payments_provider == "robokassa":
        if settings.payments_mode == "test":
            password1 = settings.robokassa_test_password1 or settings.robokassa_password1
            password2 = settings.robokassa_test_password2 or settings.robokassa_password2
            password3 = ""
        else:
            password1 = settings.robokassa_live_password1
            password2 = settings.robokassa_live_password2
            password3 = settings.robokassa_live_password3
        return RobokassaPaymentProvider(
            merchant_login=settings.robokassa_merchant_login,
            password1=password1,
            password2=password2,
            password3=password3,
            hash_algorithm=settings.robokassa_hash_algorithm,
            payment_url=settings.robokassa_payment_url,
            op_state_url=settings.robokassa_op_state_url,
            refund_url=settings.robokassa_refund_url,
            refund_state_url=settings.robokassa_refund_state_url,
            timeout_seconds=settings.robokassa_timeout_seconds,
            test_mode=settings.payments_mode == "test",
            fiscalization_mode=settings.payments_fiscalization_mode,
        )
    raise PaymentConfigurationError("Unsupported payment provider")


def payment_catalog() -> dict:
    products = [get_product(code) for code in PRODUCT_CODES]
    return {
        "enabled": settings.payments_enabled,
        "provider": settings.payments_provider if settings.payments_enabled else None,
        "mode": settings.payments_mode,
        "terms_version": settings.payments_terms_version,
        "products": [
            {
                "code": product.code,
                "name": product.name,
                "description": product.description,
                "amount": product.amount,
                "currency": product.currency,
                "access_days": product.access_days,
                "service_result": product.service_result,
                "fulfillment_code": product.fulfillment_code,
                "receipt": {
                    "name": product.receipt_item.name,
                    "payment_method": product.receipt_item.payment_method,
                    "payment_object": product.receipt_item.payment_object,
                    "tax": product.receipt_item.tax,
                },
                "refund_policy_url": (
                    f"{settings.public_base_url.rstrip('/')}{product.refund_policy_path}"
                ),
            }
            for product in products
        ],
    }


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _sanitized_payment_payload(payment: ProviderPayment) -> dict:
    return {
        "id": payment.external_id,
        "status": payment.status,
        "amount": f"{payment.amount:.2f}",
        "currency": payment.currency,
        "order_id": payment.order_public_id,
        "test": payment.is_test,
    }


def _sanitized_refund_payload(refund: ProviderRefund) -> dict:
    return {
        "id": refund.external_id,
        "payment_id": refund.payment_external_id,
        "status": refund.status,
        "amount": f"{refund.amount:.2f}",
        "currency": refund.currency,
    }


def _add_event_once(
    db: Session,
    *,
    provider: str,
    external_event_id: str,
    event_type: str,
    payload: dict,
) -> PaymentEvent | None:
    existing = db.scalar(
        select(PaymentEvent).where(
            PaymentEvent.provider == provider,
            PaymentEvent.external_event_id == external_event_id,
        )
    )
    if existing is not None:
        return None
    event = PaymentEvent(
        provider=provider,
        external_event_id=external_event_id,
        event_type=event_type,
        status="received",
        payload=payload,
    )
    try:
        with db.begin_nested():
            db.add(event)
            db.flush()
    except IntegrityError:
        return None
    return event


def _validate_payment(order: PaymentOrder, payment: ProviderPayment) -> None:
    expected_test = settings.payments_mode == "test"
    if payment.order_public_id != order.public_id:
        raise PaymentValidationError("Provider order id does not match")
    if payment.amount != order.amount or payment.currency != order.currency:
        raise PaymentValidationError("Provider amount does not match the server order")
    if payment.is_test != expected_test:
        raise PaymentValidationError("Provider test/live mode does not match")
    if order.external_payment_id and payment.external_id != order.external_payment_id:
        raise PaymentValidationError("Provider payment id does not match")


def _grant_product_access(db: Session, order: PaymentOrder, product: Product) -> None:
    if product.fulfillment_code != "premium_entitlement":
        raise PaymentConfigurationError("Unsupported product fulfillment")
    source = f"payment:{order.public_id}"
    if db.scalar(select(Entitlement).where(Entitlement.source == source)) is not None:
        return
    now = datetime.now(timezone.utc)
    end_base = now
    current = db.scalars(
        select(Entitlement).where(
            Entitlement.user_id == order.user_id,
            Entitlement.code == product.entitlement_code,
            Entitlement.revoked_at.is_(None),
        )
    ).all()
    for entitlement in current:
        ends_at = _utc(entitlement.ends_at)
        if ends_at is not None and ends_at > end_base:
            end_base = ends_at
    db.add(
        Entitlement(
            user_id=order.user_id,
            code=product.entitlement_code,
            source=source,
            starts_at=end_base,
            ends_at=end_base + timedelta(days=product.access_days),
        )
    )


def _revoke_product_access(db: Session, order: PaymentOrder) -> None:
    entitlement = db.scalar(
        select(Entitlement).where(
            Entitlement.user_id == order.user_id,
            Entitlement.source == f"payment:{order.public_id}",
            Entitlement.revoked_at.is_(None),
        )
    )
    if entitlement is not None:
        entitlement.revoked_at = datetime.now(timezone.utc)
        if entitlement.ends_at is None:
            raise PaymentConfigurationError("Payment entitlement must have a finite end")
        duration = timedelta(days=order_product(order).access_days)
        shifted_sources: list[str] = []
        later_entitlements = db.scalars(
            select(Entitlement).where(
                Entitlement.user_id == order.user_id,
                Entitlement.code == entitlement.code,
                Entitlement.id != entitlement.id,
                Entitlement.source.like("payment:%"),
                Entitlement.revoked_at.is_(None),
                Entitlement.ends_at.is_not(None),
                Entitlement.ends_at > entitlement.ends_at,
            )
        ).all()
        for later in later_entitlements:
            later_end = later.ends_at
            if later_end is None:
                continue
            later.starts_at -= duration
            later.ends_at = later_end - duration
            shifted_sources.append(later.source)
        for source in shifted_sources:
            shifted_order = db.scalar(
                select(PaymentOrder).where(PaymentOrder.public_id == source.removeprefix("payment:"))
            )
            if shifted_order is not None:
                _sync_subscription(db, shifted_order, order_product(shifted_order))


def _sync_subscription(db: Session, order: PaymentOrder, product: Product) -> None:
    if not order.external_payment_id:
        return
    subscription = db.scalar(
        select(Subscription).where(Subscription.external_id == order.external_payment_id)
    )
    status = {
        "succeeded": "active",
        "refunded": "canceled",
        "canceled": "canceled",
    }.get(order.status, "trialing")
    entitlement = db.scalar(
        select(Entitlement).where(Entitlement.source == f"payment:{order.public_id}")
    )
    period_end = entitlement.ends_at if entitlement else None
    if subscription is None:
        db.add(
            Subscription(
                user_id=order.user_id,
                provider=order.provider,
                external_id=order.external_payment_id,
                status=status,
                current_period_end=period_end,
            )
        )
    else:
        subscription.status = status
        subscription.current_period_end = period_end


def process_payment_update(
    db: Session,
    *,
    provider_code: str,
    event_id: str,
    event_type: str,
    payment: ProviderPayment,
) -> str:
    order = db.scalar(
        select(PaymentOrder).where(
            (PaymentOrder.external_payment_id == payment.external_id)
            | (PaymentOrder.public_id == payment.order_public_id)
        )
    )
    if order is None or order.provider != provider_code:
        return "ignored"
    _validate_payment(order, payment)
    event = _add_event_once(
        db,
        provider=provider_code,
        external_event_id=event_id,
        event_type=event_type,
        payload=_sanitized_payment_payload(payment),
    )
    if event is None:
        return "already_processed"

    allowed = {"pending", "waiting_for_capture", "succeeded", "canceled"}
    if payment.status not in allowed:
        event.status = "ignored"
        event.processed_at = datetime.now(timezone.utc)
        db.commit()
        return "ignored"
    if (
        order.status == "refunded"
        or (order.status == "succeeded" and payment.status != "succeeded")
        or (order.status == "canceled" and payment.status != "canceled")
    ):
        event.status = "ignored_terminal_state"
        event.processed_at = datetime.now(timezone.utc)
        db.commit()
        return "ignored"

    order.external_payment_id = payment.external_id
    order.status = payment.status
    if payment.confirmation_url:
        order.confirmation_url = payment.confirmation_url
    if payment.status == "succeeded":
        order.paid_at = order.paid_at or datetime.now(timezone.utc)
        _grant_product_access(db, order, order_product(order))
    elif payment.status == "canceled":
        order.canceled_at = order.canceled_at or datetime.now(timezone.utc)
    _sync_subscription(db, order, order_product(order))
    event.status = "processed"
    event.processed_at = datetime.now(timezone.utc)
    db.commit()
    return "processed"


def _validate_refund(order: PaymentOrder, refund: ProviderRefund) -> None:
    if refund.payment_external_id != order.external_payment_id:
        raise PaymentValidationError("Refund payment id does not match")
    if refund.amount != order.amount or refund.currency != order.currency:
        raise PaymentValidationError("Refund amount does not match the server order")


def process_refund_update(
    db: Session,
    *,
    provider_code: str,
    event_id: str,
    event_type: str,
    refund: ProviderRefund,
) -> str:
    order = db.scalar(
        select(PaymentOrder).where(
            PaymentOrder.external_payment_id == refund.payment_external_id,
            PaymentOrder.provider == provider_code,
        )
    )
    if order is None:
        return "ignored"
    _validate_refund(order, refund)
    local_refund = db.scalar(
        select(PaymentRefund).where(
            (PaymentRefund.external_refund_id == refund.external_id)
            | (
                (PaymentRefund.payment_order_id == order.id)
                & (PaymentRefund.external_refund_id.is_(None))
            )
        )
    )
    if local_refund is None:
        return "ignored"
    event = _add_event_once(
        db,
        provider=provider_code,
        external_event_id=event_id,
        event_type=event_type,
        payload=_sanitized_refund_payload(refund),
    )
    if event is None:
        return "already_processed"
    if refund.status not in {"pending", "succeeded", "canceled"}:
        event.status = "ignored"
        event.processed_at = datetime.now(timezone.utc)
        db.commit()
        return "ignored"

    local_refund.external_refund_id = refund.external_id
    local_refund.status = refund.status
    if refund.status == "succeeded":
        local_refund.succeeded_at = local_refund.succeeded_at or datetime.now(timezone.utc)
        order.status = "refunded"
        _revoke_product_access(db, order)
        _sync_subscription(db, order, order_product(order))
    event.status = "processed"
    event.processed_at = datetime.now(timezone.utc)
    db.commit()
    return "processed"


async def create_payment_order(
    db: Session,
    *,
    user: User,
    product_code: str,
    client_idempotency_key: str,
    accepted_terms: bool,
    terms_version: str,
) -> PaymentOrder:
    if not settings.payments_enabled:
        raise PaymentConfigurationError("Payments are disabled")
    product = get_product(product_code)
    if not accepted_terms or terms_version != settings.payments_terms_version:
        raise PaymentValidationError("The current payment terms must be accepted")
    order = db.scalar(
        select(PaymentOrder).where(
            PaymentOrder.user_id == user.id,
            PaymentOrder.client_idempotency_key == client_idempotency_key,
        )
    )
    if order is None:
        order = PaymentOrder(
            public_id=str(uuid4()),
            user_id=user.id,
            product_code=product.code,
            provider=settings.payments_provider,
            client_idempotency_key=client_idempotency_key,
            status="creating",
            amount=product.amount,
            currency=product.currency,
            description=product.description,
            product_snapshot=_product_snapshot(product),
            terms_version=terms_version,
            terms_accepted_at=datetime.now(timezone.utc),
            is_test=settings.payments_mode == "test",
        )
        db.add(order)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            order = db.scalar(
                select(PaymentOrder).where(
                    PaymentOrder.user_id == user.id,
                    PaymentOrder.client_idempotency_key == client_idempotency_key,
                )
            )
            if order is None:
                raise
    if order.product_code != product_code:
        raise PaymentValidationError("Idempotency key was already used for another product")
    if order.status != "creating" and order.status != "failed":
        return order

    provider = get_payment_provider()
    return_url = f"{settings.public_base_url.rstrip('/')}/payments/return?order_id={order.public_id}"
    try:
        payment = await provider.create_payment(
            order_public_id=order.public_id,
            amount=product.amount,
            currency=product.currency,
            description=product.receipt_item.name,
            receipt_item=product.receipt_item,
            customer_email=user.email,
            return_url=return_url,
            idempotency_key=order.public_id,
            provider_reference=str(order.id),
        )
        _validate_payment(order, payment)
        if payment.confirmation_url:
            if settings.payments_provider == "demo":
                if payment.confirmation_url != f"/payments/demo/{order.public_id}":
                    raise PaymentValidationError("Demo provider returned an unsafe URL")
            else:
                confirmation = urlsplit(payment.confirmation_url)
                if confirmation.scheme != "https" or not confirmation.netloc:
                    raise PaymentValidationError(
                        "Provider confirmation URL must use absolute HTTPS"
                    )
        order.external_payment_id = payment.external_id
        order.confirmation_url = payment.confirmation_url
        db.commit()
        process_payment_update(
            db,
            provider_code=provider.code,
            event_id=f"create:{payment.external_id}:{payment.status}",
            event_type="payment.created_response",
            payment=payment,
        )
    except (PaymentProviderError, PaymentValidationError):
        db.rollback()
        order.status = "failed"
        db.commit()
        raise
    db.refresh(order)
    return order


async def process_webhook(
    db: Session, *, provider: PaymentProvider, body: bytes, headers: dict[str, str]
) -> WebhookProcessResult:
    verified: VerifiedWebhook = await provider.authenticate_webhook(body, headers)
    if verified.object_type == "payment" and verified.payment is not None:
        return WebhookProcessResult(
            status=process_payment_update(
                db,
                provider_code=provider.code,
                event_id=verified.event_id,
                event_type=verified.event_type,
                payment=verified.payment,
            ),
            acknowledgement=verified.acknowledgement,
        )
    if verified.object_type == "refund" and verified.refund is not None:
        return WebhookProcessResult(
            status=process_refund_update(
                db,
                provider_code=provider.code,
                event_id=verified.event_id,
                event_type=verified.event_type,
                refund=verified.refund,
            ),
            acknowledgement=verified.acknowledgement,
        )
    raise PaymentValidationError("Unsupported verified webhook")


def complete_demo_payment(
    db: Session, *, order: PaymentOrder, user: User, outcome: str
) -> str:
    if not (
        settings.payments_enabled
        and settings.payments_provider == "demo"
        and settings.payments_mode == "test"
        and settings.demo_mode
    ):
        raise PaymentConfigurationError("Demo checkout is disabled")
    if order.user_id != user.id:
        raise PaymentValidationError("Payment order does not belong to this user")
    if not order.external_payment_id:
        raise PaymentValidationError("Payment order is not initialized")
    payment = ProviderPayment(
        external_id=order.external_payment_id,
        status=outcome,
        amount=order.amount,
        currency=order.currency,
        confirmation_url=order.confirmation_url,
        order_public_id=order.public_id,
        is_test=True,
    )
    return process_payment_update(
        db,
        provider_code="demo",
        event_id=f"demo-checkout:{order.public_id}:{outcome}",
        event_type=f"payment.{outcome}",
        payment=payment,
    )


async def create_full_refund(
    db: Session,
    *,
    order: PaymentOrder,
    reason: str,
    idempotency_key: str,
) -> PaymentRefund:
    if not settings.payments_enabled:
        raise PaymentConfigurationError("Payments are disabled")
    if order.status not in {"succeeded", "refunded"} or not order.external_payment_id:
        raise PaymentValidationError("Only a succeeded payment can be refunded")
    existing = db.scalar(
        select(PaymentRefund).where(PaymentRefund.idempotency_key == idempotency_key)
    )
    if existing is not None:
        if existing.payment_order_id != order.id:
            raise PaymentValidationError("Refund idempotency key belongs to another order")
        return existing
    if order.status == "refunded":
        existing = db.scalar(
            select(PaymentRefund).where(
                PaymentRefund.payment_order_id == order.id,
                PaymentRefund.status == "succeeded",
            )
        )
        if existing is not None:
            return existing
        raise PaymentValidationError("Payment is already refunded")

    local_refund = PaymentRefund(
        public_id=str(uuid4()),
        payment_order_id=order.id,
        provider=order.provider,
        idempotency_key=idempotency_key,
        status="pending",
        amount=order.amount,
        currency=order.currency,
        reason=reason,
    )
    db.add(local_refund)
    db.commit()
    provider = get_payment_provider()
    try:
        refund = await provider.create_refund(
            payment_external_id=order.external_payment_id,
            amount=order.amount,
            currency=order.currency,
            description=order.description,
            receipt_item=order_product(order).receipt_item,
            idempotency_key=local_refund.public_id,
        )
        _validate_refund(order, refund)
        local_refund.external_refund_id = refund.external_id
        db.commit()
        process_refund_update(
            db,
            provider_code=provider.code,
            event_id=f"create:{refund.external_id}:{refund.status}",
            event_type="refund.created_response",
            refund=refund,
        )
    except (PaymentProviderError, PaymentValidationError):
        db.rollback()
        local_refund.status = "failed"
        db.commit()
        raise
    db.refresh(local_refund)
    return local_refund


async def reconcile_pending_refunds(db: Session, *, limit: int = 50) -> dict[str, int]:
    if not (
        settings.payments_enabled
        and settings.payments_provider == "robokassa"
        and settings.payments_mode == "live"
    ):
        return {"checked": 0, "updated": 0, "failed": 0}
    provider = get_payment_provider()
    if not isinstance(provider, RobokassaPaymentProvider):
        raise PaymentConfigurationError("Robokassa provider is not configured")
    rows = db.execute(
        select(PaymentRefund, PaymentOrder)
        .join(PaymentOrder, PaymentOrder.id == PaymentRefund.payment_order_id)
        .where(
            PaymentRefund.provider == "robokassa",
            PaymentRefund.status == "pending",
            PaymentRefund.external_refund_id.is_not(None),
            PaymentOrder.external_payment_id.is_not(None),
        )
        .order_by(PaymentRefund.created_at)
        .limit(limit)
    ).all()
    updated = failed = 0
    for local_refund, order in rows:
        try:
            refund = await provider.get_refund(
                request_id=local_refund.external_refund_id,
                payment_external_id=order.external_payment_id,
                amount=local_refund.amount,
                currency=local_refund.currency,
            )
            outcome = process_refund_update(
                db,
                provider_code="robokassa",
                event_id=f"reconcile:{refund.external_id}:{refund.status}",
                event_type="refund.reconciled",
                refund=refund,
            )
            updated += int(outcome == "processed")
        except (PaymentProviderError, PaymentValidationError):
            failed += 1
            db.rollback()
    return {"checked": len(rows), "updated": updated, "failed": failed}
