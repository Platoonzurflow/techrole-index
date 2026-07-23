import hashlib
import hmac
import re
import secrets
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import case, distinct, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AnalyticsEvent, User
from app.schemas import AnalyticsCrawlerEventIn, AnalyticsEventIn
from app.security import optional_user, require_admin, require_csrf

router = APIRouter(prefix="/analytics", tags=["analytics"])
admin_router = APIRouter(
    prefix="/admin/analytics",
    tags=["admin", "analytics"],
    dependencies=[Depends(require_csrf)],
)

MOSCOW = ZoneInfo("Europe/Moscow")
PRIVATE_PREFIXES = ("/account", "/admin", "/alerts", "/dashboard", "/login", "/register", "/payments", "/api")
AUTOMATION_USER_AGENT = re.compile(
    r"playwright|headlesschrome|lighthouse|pagespeed|curl|wget|python|powershell|go-http-client",
    re.IGNORECASE,
)
REFERRER_HOST = re.compile(r"^[a-z0-9.-]{1,255}$")
AI_REFERRERS = (
    "chatgpt.com",
    "perplexity.ai",
    "claude.ai",
    "gemini.google.com",
    "copilot.microsoft.com",
)


def _event_date() -> date:
    return datetime.now(timezone.utc).astimezone(MOSCOW).date()


def _clean_path(value: str, *, private_allowed: bool = False) -> str | None:
    if not value.startswith("/") or value.startswith("//"):
        return None
    parsed = urlsplit(value)
    path = parsed.path
    if not path or len(path) > 512:
        return None
    if not private_allowed and any(path == prefix or path.startswith(f"{prefix}/") for prefix in PRIVATE_PREFIXES):
        return None
    fragment = parsed.fragment
    if fragment and re.fullmatch(r"[A-Za-z0-9_-]{1,80}", fragment):
        return f"{path}#{fragment}"
    return path


def _visitor_hash(visitor_id: str) -> str:
    return hmac.new(
        settings.analytics_hash_key.encode(),
        visitor_id.encode(),
        hashlib.sha256,
    ).hexdigest()


def _external_referrer(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower().rstrip(".")
    return normalized if REFERRER_HOST.fullmatch(normalized) else None


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
def collect_browser_event(
    payload: AnalyticsEventIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(optional_user),
):
    if not settings.analytics_enabled:
        raise HTTPException(status_code=404, detail="Analytics is disabled")
    origin = request.headers.get("origin", "").rstrip("/")
    if origin and origin != settings.frontend_origin.rstrip("/"):
        raise HTTPException(status_code=403, detail="Cross-origin analytics is not accepted")
    if user is not None and user.role == "admin":
        return {"status": "excluded_owner"}
    if AUTOMATION_USER_AGENT.search(request.headers.get("user-agent", "")):
        return {"status": "excluded_automation"}
    path = _clean_path(payload.path)
    target = _clean_path(payload.target_path) if payload.target_path else None
    if path is None or (payload.event_type == "click" and target is None):
        return {"status": "ignored_private_or_invalid"}
    visitor_hash = _visitor_hash(payload.visitor_id)
    recent_count = db.scalar(
        select(func.count(AnalyticsEvent.id)).where(
            AnalyticsEvent.visitor_hash == visitor_hash,
            AnalyticsEvent.occurred_at >= datetime.now(timezone.utc) - timedelta(minutes=1),
        )
    ) or 0
    if recent_count >= 60:
        return {"status": "rate_limited"}
    db.add(
        AnalyticsEvent(
            event_date=_event_date(),
            visitor_hash=visitor_hash,
            user_id=user.id if user is not None else None,
            category="human",
            event_type=payload.event_type,
            path=path,
            target_path=target,
            referrer_host=_external_referrer(payload.referrer_host),
        )
    )
    db.commit()
    return {"status": "accepted"}


@router.post("/crawler", status_code=status.HTTP_202_ACCEPTED, include_in_schema=False)
def collect_crawler_event(
    payload: AnalyticsCrawlerEventIn,
    ingest_key: str = Header(default="", alias="X-Analytics-Ingest-Key"),
    db: Session = Depends(get_db),
):
    if not settings.analytics_enabled or not settings.analytics_ingest_key:
        raise HTTPException(status_code=404, detail="Analytics is disabled")
    if not secrets.compare_digest(ingest_key, settings.analytics_ingest_key):
        raise HTTPException(status_code=401, detail="Invalid analytics ingest key")
    path = _clean_path(payload.path, private_allowed=True)
    if path is None:
        return {"status": "ignored_invalid"}
    db.add(
        AnalyticsEvent(
            event_date=_event_date(),
            category=payload.category,
            event_type="crawler_request",
            path=path,
            crawler_name=payload.crawler_name,
        )
    )
    db.commit()
    return {"status": "accepted"}


def _grouped_rows(db: Session, statement) -> list[dict[str, int | str]]:
    return [
        {"label": str(label), "count": int(count)}
        for label, count in db.execute(statement).all()
        if label
    ]


@admin_router.get("")
def analytics_overview(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    today = _event_date()
    date_from = today - timedelta(days=days - 1)
    human_pageview = (
        (AnalyticsEvent.category == "human")
        & (AnalyticsEvent.event_type == "pageview")
    )
    daily = db.execute(
        select(
            AnalyticsEvent.event_date,
            func.count(distinct(case((human_pageview, AnalyticsEvent.visitor_hash)))).label("unique_humans"),
            func.count().filter(human_pageview).label("pageviews"),
            func.count().filter(AnalyticsEvent.event_type == "click").label("clicks"),
            func.count().filter(AnalyticsEvent.event_type == "citation_copy").label("citation_copies"),
            func.count().filter(AnalyticsEvent.category == "ai_crawler").label("ai_crawler_requests"),
            func.count().filter(AnalyticsEvent.category == "search_crawler").label("search_crawler_requests"),
        )
        .where(AnalyticsEvent.event_date >= date_from)
        .group_by(AnalyticsEvent.event_date)
        .order_by(AnalyticsEvent.event_date)
    ).all()
    daily_by_date = {
        row.event_date: {
            "date": row.event_date.isoformat(),
            "unique_humans": int(row.unique_humans),
            "pageviews": int(row.pageviews),
            "clicks": int(row.clicks),
            "citation_copies": int(row.citation_copies),
            "ai_crawler_requests": int(row.ai_crawler_requests),
            "search_crawler_requests": int(row.search_crawler_requests),
        }
        for row in daily
    }
    daily_complete = []
    for offset in range(days):
        current = date_from + timedelta(days=offset)
        daily_complete.append(daily_by_date.get(current, {
            "date": current.isoformat(),
            "unique_humans": 0,
            "pageviews": 0,
            "clicks": 0,
            "citation_copies": 0,
            "ai_crawler_requests": 0,
            "search_crawler_requests": 0,
        }))

    base = AnalyticsEvent.event_date >= date_from
    top_pages = _grouped_rows(
        db,
        select(AnalyticsEvent.path, func.count())
        .where(base, human_pageview)
        .group_by(AnalyticsEvent.path)
        .order_by(func.count().desc(), AnalyticsEvent.path)
        .limit(20),
    )
    click_targets = _grouped_rows(
        db,
        select(AnalyticsEvent.target_path, func.count())
        .where(base, AnalyticsEvent.category == "human", AnalyticsEvent.event_type == "click")
        .group_by(AnalyticsEvent.target_path)
        .order_by(func.count().desc(), AnalyticsEvent.target_path)
        .limit(20),
    )
    referrers = _grouped_rows(
        db,
        select(AnalyticsEvent.referrer_host, func.count())
        .where(base, human_pageview, AnalyticsEvent.referrer_host.is_not(None))
        .group_by(AnalyticsEvent.referrer_host)
        .order_by(func.count().desc(), AnalyticsEvent.referrer_host)
        .limit(20),
    )
    crawlers = _grouped_rows(
        db,
        select(AnalyticsEvent.crawler_name, func.count())
        .where(base, AnalyticsEvent.event_type == "crawler_request")
        .group_by(AnalyticsEvent.crawler_name)
        .order_by(func.count().desc(), AnalyticsEvent.crawler_name),
    )
    unique_humans = db.scalar(
        select(func.count(distinct(AnalyticsEvent.visitor_hash))).where(base, human_pageview)
    ) or 0
    ai_referrals = db.scalar(
        select(func.count()).where(
            base,
            human_pageview,
            AnalyticsEvent.referrer_host.in_(AI_REFERRERS),
        )
    ) or 0
    return {
        "date_from": date_from,
        "date_to": today,
        "days": days,
        "totals": {
            "unique_humans": int(unique_humans),
            "pageviews": sum(item["pageviews"] for item in daily_complete),
            "clicks": sum(item["clicks"] for item in daily_complete),
            "citation_copies": sum(item["citation_copies"] for item in daily_complete),
            "ai_referrals": int(ai_referrals),
            "ai_crawler_requests": sum(item["ai_crawler_requests"] for item in daily_complete),
            "search_crawler_requests": sum(item["search_crawler_requests"] for item in daily_complete),
        },
        "daily": daily_complete,
        "top_pages": top_pages,
        "click_targets": click_targets,
        "referrers": referrers,
        "crawlers": crawlers,
        "measurement_notes": {
            "unique_humans": "Уникальный согласившийся браузер по псевдонимному first-party идентификатору; администраторы и automation user-agents исключены.",
            "citations": "Полное число цитирований внешними системами технически недоступно. Показаны измеримые копирования цитаты и переходы с известных AI-доменов.",
            "crawlers": "Только запросы с официально заявленным User-Agent; Googlebot нельзя достоверно разделить на обычный поиск и AI-функции.",
        },
    }
