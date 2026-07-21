from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Entitlement, PaymentEvent, Subscription, User
from app.providers.payments import DemoPaymentProvider
from app.schemas import DemoPurchaseResponse
from app.security import require_csrf, require_user

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post(
    "/demo/purchase", response_model=DemoPurchaseResponse, dependencies=[Depends(require_csrf)]
)
def demo_purchase(db: Session = Depends(get_db), user: User = Depends(require_user)):
    if not settings.demo_mode:
        raise HTTPException(status_code=404, detail="Demo payments disabled")
    provider = DemoPaymentProvider(settings.app_secret_key)
    result = provider.purchase(user.id)
    subscription = db.scalar(
        select(Subscription).where(Subscription.external_id == result.external_id)
    )
    if subscription is None:
        subscription = Subscription(
            user_id=user.id,
            provider=provider.code,
            external_id=result.external_id,
            status=result.status,
            current_period_end=result.period_end,
        )
        db.add(subscription)
    else:
        subscription.status = result.status
        subscription.current_period_end = result.period_end
    entitlement = db.scalar(
        select(Entitlement).where(
            Entitlement.user_id == user.id,
            Entitlement.code == "premium",
            Entitlement.revoked_at.is_(None),
        )
    )
    if entitlement is None:
        db.add(
            Entitlement(
                user_id=user.id, code="premium", source="demo_payment", ends_at=result.period_end
            )
        )
    else:
        entitlement.ends_at = result.period_end
    db.commit()
    return DemoPurchaseResponse(
        status=result.status,
        subscription_id=result.external_id,
        current_period_end=result.period_end,
    )


@router.post("/webhooks/demo")
async def demo_webhook(
    request: Request,
    signature: str = Header(alias="X-Demo-Signature"),
    db: Session = Depends(get_db),
):
    body = await request.body()
    provider = DemoPaymentProvider(settings.app_secret_key)
    if not provider.verify_webhook(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    payload = await request.json()
    allowed_statuses = {"trialing", "active", "past_due", "canceled", "expired"}
    if payload.get("status") not in allowed_statuses:
        raise HTTPException(status_code=422, detail="Unknown subscription status")
    event = PaymentEvent(
        provider=provider.code,
        external_event_id=str(payload["event_id"]),
        event_type=str(payload.get("type", "subscription.updated")),
        status="received",
        payload=payload,
    )
    db.add(event)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "already_processed"}
    subscription = db.scalar(
        select(Subscription).where(Subscription.external_id == str(payload["subscription_id"]))
    )
    if subscription:
        subscription.status = payload["status"]
        if payload["status"] in {"canceled", "expired"}:
            entitlements = db.scalars(
                select(Entitlement).where(
                    Entitlement.user_id == subscription.user_id,
                    Entitlement.code == "premium",
                    Entitlement.revoked_at.is_(None),
                )
            ).all()
            for entitlement in entitlements:
                entitlement.revoked_at = datetime.now(timezone.utc)
    event.status = "processed"
    event.processed_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "processed"}
