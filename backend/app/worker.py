from celery import Celery

from app.config import settings

celery_app = Celery("techrole", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Moscow",
    beat_schedule={
        "nightly-demo-ingestion": {
            "task": "app.worker.nightly_ingestion",
            "schedule": 60 * 60 * 24,
        },
        "nightly-score-recalculation": {
            "task": "app.worker.recalculate_metrics",
            "schedule": 60 * 60 * 24,
        },
        "retry-support-delivery": {
            "task": "app.worker.retry_support_deliveries",
            "schedule": 60 * 60,
        },
        "retry-mentorship-delivery": {
            "task": "app.worker.retry_mentorship_deliveries",
            "schedule": 60 * 60,
        },
        "reconcile-payment-refunds": {
            "task": "app.worker.reconcile_payment_refunds",
            "schedule": 60 * 5,
        },
    },
)


@celery_app.task(name="app.worker.nightly_ingestion")
def nightly_ingestion() -> dict:
    # The MVP seed is immutable. Production providers plug into the same task without enabling HH implicitly.
    return {"status": "skipped", "reason": "demo dataset is deterministic"}


@celery_app.task(name="app.worker.recalculate_metrics")
def recalculate_metrics() -> dict:
    from app.database import SessionLocal
    from app.services.scoring_service import recompute_scores

    with SessionLocal() as db:
        profession_count = recompute_scores(db)
    return {"status": "ok", "scores_recalculated": profession_count}


@celery_app.task(bind=True, name="app.worker.deliver_support_request", max_retries=4)
def deliver_support_request(self, support_id: int) -> dict:
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import SupportRequest
    from app.providers.email import (
        EmailDeliveryNotConfigured,
        SupportEmail,
        get_email_provider,
    )

    with SessionLocal() as db:
        # Claim the row under a database lock before releasing the transaction for SMTP I/O.
        # A duplicate Celery delivery will then observe `processing` or `sent` and exit.
        support_request = db.scalar(
            select(SupportRequest)
            .where(SupportRequest.id == support_id)
            .with_for_update()
        )
        if support_request is None:
            return {"status": "missing", "support_id": support_id}
        if support_request.status == "sent":
            return {"status": "already_sent", "support_id": support_id}
        if support_request.status == "processing":
            return {"status": "already_processing", "support_id": support_id}
        support_request.status = "processing"
        support_request.delivery_attempts += 1
        db.commit()
        try:
            get_email_provider().send_support(
                SupportEmail(
                    public_id=support_request.public_id,
                    name=support_request.name,
                    reply_to=support_request.email,
                    topic=support_request.topic,
                    subject=support_request.subject,
                    message=support_request.message,
                )
            )
        except EmailDeliveryNotConfigured:
            support_request.status = "pending_configuration"
            support_request.last_error = "EmailDeliveryNotConfigured"
            db.commit()
            return {"status": "pending_configuration", "support_id": support_id}
        except Exception as exc:
            support_request.status = "failed"
            support_request.last_error = type(exc).__name__[:160]
            db.commit()
            raise self.retry(
                exc=exc, countdown=min(60 * 2**self.request.retries, 3600)
            ) from exc
        support_request.status = "sent"
        support_request.delivered_at = datetime.now(timezone.utc)
        support_request.last_error = None
        db.commit()
        return {"status": "sent", "support_id": support_id}


@celery_app.task(name="app.worker.retry_support_deliveries")
def retry_support_deliveries() -> dict:
    if not settings.support_email_enabled:
        return {"status": "skipped", "reason": "support email is not configured"}

    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import SupportRequest

    with SessionLocal() as db:
        support_ids = db.scalars(
            select(SupportRequest.id)
            .where(
                SupportRequest.status.in_(("pending", "failed", "pending_configuration")),
                SupportRequest.delivery_attempts < 5,
            )
            .order_by(SupportRequest.created_at)
            .limit(50)
        ).all()
    for support_id in support_ids:
        deliver_support_request.delay(support_id)
    return {"status": "queued", "count": len(support_ids)}


@celery_app.task(bind=True, name="app.worker.deliver_mentorship_request", max_retries=4)
def deliver_mentorship_request(self, mentorship_id: int) -> dict:
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import MentorshipRequest
    from app.providers.email import (
        EmailDeliveryNotConfigured,
        MentorshipEmail,
        get_email_provider,
    )

    with SessionLocal() as db:
        mentorship_request = db.scalar(
            select(MentorshipRequest)
            .where(MentorshipRequest.id == mentorship_id)
            .with_for_update()
        )
        if mentorship_request is None:
            return {"status": "missing", "mentorship_id": mentorship_id}
        if mentorship_request.status == "sent":
            return {"status": "already_sent", "mentorship_id": mentorship_id}
        if mentorship_request.status == "processing":
            return {"status": "already_processing", "mentorship_id": mentorship_id}
        mentorship_request.status = "processing"
        mentorship_request.delivery_attempts += 1
        db.commit()
        try:
            get_email_provider().send_mentorship(
                MentorshipEmail(
                    public_id=mentorship_request.public_id,
                    name=mentorship_request.name,
                    contact=mentorship_request.contact,
                    direction=mentorship_request.direction,
                    level=mentorship_request.level,
                    context=mentorship_request.context,
                )
            )
        except EmailDeliveryNotConfigured:
            mentorship_request.status = "pending_configuration"
            mentorship_request.last_error = "EmailDeliveryNotConfigured"
            db.commit()
            return {"status": "pending_configuration", "mentorship_id": mentorship_id}
        except Exception as exc:
            mentorship_request.status = "failed"
            mentorship_request.last_error = type(exc).__name__[:160]
            db.commit()
            raise self.retry(
                exc=exc, countdown=min(60 * 2**self.request.retries, 3600)
            ) from exc
        mentorship_request.status = "sent"
        mentorship_request.delivered_at = datetime.now(timezone.utc)
        mentorship_request.last_error = None
        db.commit()
        return {"status": "sent", "mentorship_id": mentorship_id}


@celery_app.task(name="app.worker.retry_mentorship_deliveries")
def retry_mentorship_deliveries() -> dict:
    if not settings.support_email_enabled:
        return {"status": "skipped", "reason": "email is not configured"}

    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import MentorshipRequest

    with SessionLocal() as db:
        mentorship_ids = db.scalars(
            select(MentorshipRequest.id)
            .where(
                MentorshipRequest.status.in_(
                    ("pending", "failed", "pending_configuration")
                ),
                MentorshipRequest.delivery_attempts < 5,
            )
            .order_by(MentorshipRequest.created_at)
            .limit(50)
        ).all()
    for mentorship_id in mentorship_ids:
        deliver_mentorship_request.delay(mentorship_id)
    return {"status": "queued", "count": len(mentorship_ids)}


@celery_app.task(name="app.worker.reconcile_payment_refunds")
def reconcile_payment_refunds() -> dict:
    import asyncio

    from app.database import SessionLocal
    from app.services.payments import reconcile_pending_refunds

    with SessionLocal() as db:
        return asyncio.run(reconcile_pending_refunds(db))
