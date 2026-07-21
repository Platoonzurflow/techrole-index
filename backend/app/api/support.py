from __future__ import annotations

import hashlib
import hmac
import logging
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import SupportRequest, User
from app.schemas import SupportRequestCreate, SupportRequestOut
from app.security import new_csrf_token, optional_user
from app.services.rate_limit import (
    RateLimitExceeded,
    SupportRateLimiter,
    get_support_rate_limiter,
)
from app.worker import deliver_support_request

router = APIRouter(prefix="/support", tags=["support"])
logger = logging.getLogger(__name__)


def _hash_identifier(value: str) -> str:
    return hmac.new(
        settings.app_secret_key.encode(), value.encode(), digestmod=hashlib.sha256
    ).hexdigest()


def _validate_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return
    allowed = {
        settings.frontend_origin.rstrip("/"),
        settings.public_base_url.rstrip("/"),
    }
    parsed = urlsplit(origin)
    normalized = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    if normalized not in allowed:
        raise HTTPException(status_code=403, detail="Недопустимый источник запроса")


def require_support_csrf(
    request: Request,
    csrf_cookie: str | None = Cookie(default=None, alias=settings.support_csrf_cookie_name),
) -> None:
    csrf_header = request.headers.get("X-CSRF-Token")
    if not csrf_cookie or not csrf_header or not hmac.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=403, detail="CSRF token mismatch")


@router.get("/csrf")
def support_csrf(response: Response):
    token = new_csrf_token()
    response.set_cookie(
        settings.support_csrf_cookie_name,
        token,
        httponly=False,
        secure=settings.app_env == "production",
        samesite="lax",
        max_age=3600,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"csrf_token": token}


@router.post(
    "/requests",
    response_model=SupportRequestOut,
    status_code=202,
    dependencies=[Depends(require_support_csrf)],
)
def create_support_request(
    payload: SupportRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(optional_user),
    limiter: SupportRateLimiter = Depends(get_support_rate_limiter),
):
    _validate_origin(request)
    if payload.website:
        return SupportRequestOut(
            reference=str(uuid4()),
            status="accepted",
            email_sent=False,
            message="Обращение принято.",
        )

    client_ip = request.client.host if request.client else "unknown"
    ip_hash = _hash_identifier(client_ip)
    email_hash = _hash_identifier(str(payload.email).lower())
    try:
        limiter.check(ip_hash, email_hash)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail="Слишком много обращений. Попробуйте отправить сообщение позже.",
        ) from exc

    support_request = SupportRequest(
        user_id=user.id if user else None,
        name=payload.name,
        email=str(payload.email).lower(),
        topic=payload.topic,
        subject=payload.subject,
        message=payload.message,
        status="pending",
        ip_hash=ip_hash,
    )
    db.add(support_request)
    db.commit()
    db.refresh(support_request)
    try:
        deliver_support_request.delay(support_request.id)
    except Exception:
        logger.exception(
            "support_delivery_enqueue_failed", extra={"support_id": support_request.id}
        )

    return SupportRequestOut(
        reference=support_request.public_id,
        status="queued" if settings.support_email_enabled else "saved",
        email_sent=False,
        message=(
            "Обращение принято. Ответ придёт на указанный email."
            if settings.support_email_enabled
            else "Обращение зарегистрировано. Сохраните его номер."
        ),
    )
