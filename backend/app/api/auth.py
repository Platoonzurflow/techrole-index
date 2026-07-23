import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.demo_accounts import LEGACY_DEMO_ACCOUNT_EMAILS
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, UserOut
from app.security import (
    create_access_token,
    has_premium,
    hash_password,
    new_csrf_token,
    premium_expires_at,
    require_csrf,
    require_user,
    verify_password,
)
from app.services.rate_limit import (
    AuthRateLimiter,
    RateLimiterUnavailable,
    RateLimitExceeded,
    get_auth_rate_limiter,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _check_rate_limit(request: Request, limiter: AuthRateLimiter) -> None:
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hmac.new(
        settings.app_secret_key.encode(), client_ip.encode(), digestmod=hashlib.sha256
    ).hexdigest()
    try:
        limiter.check(ip_hash)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429, detail="Слишком много попыток. Повторите позже."
        ) from exc
    except RateLimiterUnavailable as exc:
        raise HTTPException(
            status_code=503, detail="Сервис входа временно недоступен. Повторите позже."
        ) from exc


def _set_session(response: Response, user: User) -> None:
    secure = settings.app_env == "production"
    response.set_cookie(
        settings.access_cookie_name,
        create_access_token(user),
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.access_token_minutes * 60,
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        new_csrf_token(),
        httponly=False,
        secure=secure,
        samesite="lax",
        max_age=settings.access_token_minutes * 60,
        path="/",
    )


def _user_out(db: Session, user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        access_level="premium" if has_premium(db, user) else "free",
        premium_expires_at=premium_expires_at(db, user),
    )


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    limiter: AuthRateLimiter = Depends(get_auth_rate_limiter),
):
    _check_rate_limit(request, limiter)
    user = User(
        email=payload.email.lower(),
        display_name=payload.display_name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email уже зарегистрирован") from exc
    db.refresh(user)
    _set_session(response, user)
    return _user_out(db, user)


@router.post("/login", response_model=UserOut)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    limiter: AuthRateLimiter = Depends(get_auth_rate_limiter),
):
    _check_rate_limit(request, limiter)
    normalized_email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == normalized_email))
    legacy_email = None
    if user is None and settings.demo_mode:
        legacy_email = LEGACY_DEMO_ACCOUNT_EMAILS.get(normalized_email)
        if legacy_email is not None:
            user = db.scalar(select(User).where(User.email == legacy_email))
    if user is None or not verify_password(payload.password, user.password_hash) or user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль"
        )
    if legacy_email is not None:
        user.email = normalized_email
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    _set_session(response, user)
    return _user_out(db, user)


@router.post("/logout", status_code=204, dependencies=[Depends(require_csrf)])
def logout(response: Response):
    response.delete_cookie(settings.access_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(db: Session = Depends(get_db), user: User = Depends(require_user)):
    return _user_out(db, user)
