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


def get_product(code: str) -> Product:
    if code != "premium_30_days":
        raise PaymentValidationError("Unknown product")
    return Product(
        code=code,
        name="Premium на 30 дней",
        description="Доступ TechRole Index Premium на 30 дней",
        amount=settings.premium_30_days_price_rub.quantize(Decimal("0.01")),
        currency="RUB",
        access_days=30,
    )


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
    raise PaymentConfigurationError("Unsupported payment provider")


def payment_catalog() -> dict:
    product = get_product("premium_30_days")
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
            }
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
    source = f"payment:{order.public_id}"
    if db.scalar(select(Entitlement).where(Entitlement.source == source)) is not None:
        return
    now = datetime.now(timezone.utc)
    end_base = now
    current = db.scalars(
        select(Entitlement).where(
            Entitlement.user_id == order.user_id,
            Entitlement.code == "premium",
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
            code="premium",
            source=source,
            starts_at=now,
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
        _grant_product_access(db, order, get_product(order.product_code))
    elif payment.status == "canceled":
        order.canceled_at = order.canceled_at or datetime.now(timezone.utc)
    _sync_subscription(db, order, get_product(order.product_code))
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
        _sync_subscription(db, order, get_product(order.product_code))
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
            description=product.description,
            customer_email=user.email,
            return_url=return_url,
            idempotency_key=order.public_id,
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
) -> str:
    verified: VerifiedWebhook = await provider.authenticate_webhook(body, headers)
    if verified.object_type == "payment" and verified.payment is not None:
        return process_payment_update(
            db,
            provider_code=provider.code,
            event_id=verified.event_id,
            event_type=verified.event_type,
            payment=verified.payment,
        )
    if verified.object_type == "refund" and verified.refund is not None:
        return process_refund_update(
            db,
            provider_code=provider.code,
            event_id=verified.event_id,
            event_type=verified.event_type,
            refund=verified.refund,
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
            description=reason,
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
