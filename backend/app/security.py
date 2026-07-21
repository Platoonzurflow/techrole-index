import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from pwdlib import PasswordHash
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Entitlement, User

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    return password_hash.verify(password, encoded)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm="HS256")


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def optional_user(
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=settings.access_cookie_name),
) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.app_secret_key, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    user = db.get(User, user_id)
    return None if user is None or user.is_blocked else user


def require_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется вход")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора"
        )
    return user


def require_csrf(
    request: Request,
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
    csrf_cookie: str | None = Cookie(default=None, alias=settings.csrf_cookie_name),
) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    if not csrf_header or not csrf_cookie or not secrets.compare_digest(csrf_header, csrf_cookie):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token mismatch")


def has_premium(db: Session, user: User | None) -> bool:
    if user is None:
        return False
    if user.role == "admin":
        return True
    now = datetime.now(timezone.utc)
    entitlement = db.scalar(
        select(Entitlement.id).where(
            Entitlement.user_id == user.id,
            Entitlement.code == "premium",
            Entitlement.starts_at <= now,
            Entitlement.revoked_at.is_(None),
            or_(Entitlement.ends_at.is_(None), Entitlement.ends_at > now),
        )
    )
    return entitlement is not None


def require_premium(db: Session = Depends(get_db), user: User = Depends(require_user)) -> User:
    if not has_premium(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступно в Premium")
    return user
