import re

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import PaymentOrder, User
from app.providers.payments import PaymentProviderError, WebhookAuthenticationError
from app.schemas import (
    DemoPaymentCompleteRequest,
    PaymentCreateRequest,
    PaymentRefundRequest,
    PaymentRefundResponse,
    PaymentResponse,
)
from app.security import require_admin, require_csrf, require_user
from app.services.payments import (
    PaymentConfigurationError,
    PaymentValidationError,
    complete_demo_payment,
    create_full_refund,
    create_payment_order,
    get_payment_provider,
    get_product,
    payment_catalog,
    process_webhook,
)

router = APIRouter(prefix="/payments", tags=["payments"])
idempotency_key_pattern = re.compile(r"^[A-Za-z0-9._:-]{8,64}$")


def _order_response(order: PaymentOrder) -> PaymentResponse:
    product = get_product(order.product_code)
    return PaymentResponse(
        order_id=order.public_id,
        product_code=order.product_code,
        product_name=product.name,
        status=order.status,
        amount=order.amount,
        currency=order.currency,
        confirmation_url=order.confirmation_url,
        is_test=order.is_test,
    )


def _get_order(db: Session, order_id: str) -> PaymentOrder:
    order = db.scalar(select(PaymentOrder).where(PaymentOrder.public_id == order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Платёж не найден")
    return order


def _validate_idempotency_key(value: str) -> str:
    if not idempotency_key_pattern.fullmatch(value):
        raise HTTPException(status_code=422, detail="Некорректный ключ идемпотентности")
    return value


@router.get("/products")
def products():
    return payment_catalog()


@router.post(
    "", response_model=PaymentResponse, dependencies=[Depends(require_csrf)]
)
async def create_payment(
    payload: PaymentCreateRequest,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    try:
        order = await create_payment_order(
            db,
            user=user,
            product_code=payload.product_code,
            client_idempotency_key=_validate_idempotency_key(idempotency_key),
            accepted_terms=payload.accepted_terms,
            terms_version=payload.terms_version,
        )
    except PaymentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PaymentValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PaymentProviderError as exc:
        raise HTTPException(status_code=502, detail="Платёжный провайдер временно недоступен") from exc
    return _order_response(order)


@router.get("/{order_id}", response_model=PaymentResponse)
def payment_status(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    order = _get_order(db, order_id)
    if order.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=404, detail="Платёж не найден")
    return _order_response(order)


@router.post(
    "/{order_id}/demo/complete",
    response_model=PaymentResponse,
    dependencies=[Depends(require_csrf)],
)
def demo_complete(
    order_id: str,
    payload: DemoPaymentCompleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    order = _get_order(db, order_id)
    try:
        complete_demo_payment(db, order=order, user=user, outcome=payload.outcome)
    except PaymentConfigurationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PaymentValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.refresh(order)
    return _order_response(order)


@router.post(
    "/{order_id}/refund",
    response_model=PaymentRefundResponse,
    dependencies=[Depends(require_csrf)],
)
async def refund_payment(
    order_id: str,
    payload: PaymentRefundRequest,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    order = _get_order(db, order_id)
    try:
        refund = await create_full_refund(
            db,
            order=order,
            reason=payload.reason,
            idempotency_key=_validate_idempotency_key(idempotency_key),
        )
    except PaymentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PaymentValidationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PaymentProviderError as exc:
        raise HTTPException(status_code=502, detail="Платёжный провайдер временно недоступен") from exc
    return PaymentRefundResponse(
        refund_id=refund.public_id,
        order_id=order.public_id,
        status=refund.status,
        amount=refund.amount,
        currency=refund.currency,
    )


async def _webhook(provider_code: str, request: Request, db: Session) -> dict[str, str]:
    if not settings.payments_enabled or settings.payments_provider != provider_code:
        raise HTTPException(status_code=404, detail="Webhook is not configured")
    provider = get_payment_provider()
    body = await request.body()
    try:
        status = await process_webhook(
            db,
            provider=provider,
            body=body,
            headers={key.lower(): value for key, value in request.headers.items()},
        )
    except WebhookAuthenticationError as exc:
        raise HTTPException(status_code=401, detail="Invalid webhook authenticity") from exc
    except PaymentValidationError as exc:
        raise HTTPException(status_code=422, detail="Webhook does not match the server order") from exc
    except PaymentProviderError as exc:
        raise HTTPException(status_code=502, detail="Provider verification failed") from exc
    return {"status": status}


@router.post("/webhooks/demo")
async def demo_webhook(request: Request, db: Session = Depends(get_db)):
    return await _webhook("demo", request, db)


@router.post("/webhooks/yookassa")
async def yookassa_webhook(request: Request, db: Session = Depends(get_db)):
    return await _webhook("yookassa", request, db)
