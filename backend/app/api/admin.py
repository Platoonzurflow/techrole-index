from datetime import datetime, timedelta, timezone

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.domain.scoring import DEFAULT_WEIGHTS
from app.models import (
    AuditLog,
    Entitlement,
    IngestionRun,
    Profession,
    ProfessionAlias,
    ScoringVersion,
    User,
    Vacancy,
)
from app.schemas import (
    AdminUserAccessUpdate,
    AdminUserOut,
    AliasCreate,
    PaymentReadinessOut,
    ProfessionUpdate,
    ScoreVersionCreate,
)
from app.security import require_admin, require_csrf
from app.services.payment_readiness import payment_readiness
from app.worker import celery_app

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_csrf)])
ADMIN_PREMIUM_SOURCES = ("admin_grant", "admin_override")


@router.get("/payment-readiness", response_model=PaymentReadinessOut)
def get_payment_readiness(admin: User = Depends(require_admin)) -> PaymentReadinessOut:
    del admin
    return payment_readiness(settings)


def audit(
    db: Session,
    actor: User,
    request: Request,
    action: str,
    entity_type: str,
    entity_id: str | None,
    details: dict,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=request.client.host if request.client else None,
            details=details,
        )
    )


@router.get("/professions")
def professions(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    return [
        {
            "id": item.id,
            "slug": item.slug,
            "name_ru": item.name_ru,
            "name_en": item.name_en,
            "is_premium": item.is_premium,
            "is_active": item.is_active,
        }
        for item in db.scalars(select(Profession).order_by(Profession.name_ru)).all()
    ]


@router.patch("/professions/{profession_id}")
def update_profession(
    profession_id: int,
    payload: ProfessionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    profession = db.get(Profession, profession_id)
    if profession is None:
        raise HTTPException(status_code=404, detail="Профессия не найдена")
    changes = payload.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(profession, field, value)
    audit(db, admin, request, "profession.update", "profession", str(profession_id), changes)
    db.commit()
    return {"status": "updated", "id": profession.id}


@router.get("/professions/{profession_id}/aliases")
def list_aliases(
    profession_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    del admin
    return [
        {
            "id": item.id,
            "alias": item.alias,
            "is_regex": item.is_regex,
            "exclude_pattern": item.exclude_pattern,
        }
        for item in db.scalars(
            select(ProfessionAlias)
            .where(ProfessionAlias.profession_id == profession_id)
            .order_by(ProfessionAlias.alias)
        ).all()
    ]


@router.post("/professions/{profession_id}/aliases", status_code=201)
def create_alias(
    profession_id: int,
    payload: AliasCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if db.get(Profession, profession_id) is None:
        raise HTTPException(status_code=404, detail="Профессия не найдена")
    alias = ProfessionAlias(profession_id=profession_id, **payload.model_dump())
    db.add(alias)
    audit(
        db, admin, request, "alias.create", "profession", str(profession_id), payload.model_dump()
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Такой алиас уже существует") from exc
    return {"id": alias.id}


@router.get("/vacancies/uncertain")
def uncertain_vacancies(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    rows = db.scalars(
        select(Vacancy)
        .where((Vacancy.profession_id.is_(None)) | (Vacancy.classification_confidence < 0.65))
        .order_by(desc(Vacancy.last_seen_at))
        .limit(200)
    ).all()
    return [
        {
            "id": item.id,
            "title": item.title,
            "confidence": float(item.classification_confidence or 0),
            "profession_id": item.profession_id,
        }
        for item in rows
    ]


@router.patch("/vacancies/{vacancy_id}/classification")
def correct_classification(
    vacancy_id: int,
    profession_id: int,
    seniority_id: int | None,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None or db.get(Profession, profession_id) is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    vacancy.profession_id = profession_id
    vacancy.seniority_id = seniority_id
    from decimal import Decimal

    vacancy.classification_confidence = Decimal("1")
    vacancy.classifier_version = "manual-admin-v1"
    audit(
        db,
        admin,
        request,
        "vacancy.classification.correct",
        "vacancy",
        str(vacancy_id),
        {"profession_id": profession_id, "seniority_id": seniority_id},
    )
    db.commit()
    return {"status": "corrected"}


@router.post("/recalculate", status_code=202)
def recalculate(
    request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    result = celery_app.send_task("app.worker.recalculate_metrics")
    audit(db, admin, request, "metrics.recalculate", "task", result.id, {})
    db.commit()
    return {"task_id": result.id, "status": "queued"}


@router.get("/tasks/{task_id}")
def task_status(task_id: str, admin: User = Depends(require_admin)):
    del admin
    result = AsyncResult(task_id, app=celery_app)
    return {"task_id": task_id, "status": result.status, "ready": result.ready()}


@router.get("/ingestion-runs")
def ingestion_runs(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    rows = db.scalars(select(IngestionRun).order_by(desc(IngestionRun.started_at)).limit(100)).all()
    return [
        {
            "id": row.id,
            "status": row.status,
            "started_at": row.started_at,
            "finished_at": row.finished_at,
            "records_seen": row.records_seen,
            "records_changed": row.records_changed,
            "error_summary": row.error_summary,
        }
        for row in rows
    ]


@router.post("/scoring-versions", status_code=201)
def create_scoring_version(
    payload: ScoreVersionCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if (
        set(payload.weights) != set(DEFAULT_WEIGHTS)
        or abs(sum(payload.weights.values()) - 1.0) > 1e-6
        or any(value < 0 for value in payload.weights.values())
    ):
        raise HTTPException(
            status_code=422, detail="Требуются все шесть неотрицательных весов с суммой 1"
        )
    for version in db.scalars(
        select(ScoringVersion).where(ScoringVersion.is_active.is_(True))
    ).all():
        version.is_active = False
    created = ScoringVersion(**payload.model_dump(), is_active=True, created_by_user_id=admin.id)
    db.add(created)
    audit(
        db,
        admin,
        request,
        "scoring_version.create",
        "scoring_version",
        payload.version,
        {"weights": payload.weights},
    )
    db.commit()
    return {"id": created.id, "version": created.version}


@router.patch("/users/{user_id}/block")
def block_user(
    user_id: int,
    blocked: bool,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None or user.id == admin.id:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_blocked = blocked
    audit(db, admin, request, "user.block", "user", str(user_id), {"blocked": blocked})
    db.commit()
    return {"status": "updated"}


def _admin_user_out(
    user: User,
    active_entitlements: list[Entitlement],
) -> AdminUserOut:
    admin_grant_active = any(
        entitlement.source in ADMIN_PREMIUM_SOURCES for entitlement in active_entitlements
    )
    paid_premium_active = any(
        entitlement.source.startswith("payment:") for entitlement in active_entitlements
    )
    entitlement_ends = [entitlement.ends_at for entitlement in active_entitlements]
    expires_at = (
        None
        if user.role == "admin"
        or not entitlement_ends
        or any(value is None for value in entitlement_ends)
        else max(value for value in entitlement_ends if value is not None)
    )
    return AdminUserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_blocked=user.is_blocked,
        access_level="premium" if user.role == "admin" or active_entitlements else "free",
        premium_expires_at=expires_at,
        admin_grant_active=admin_grant_active,
        paid_premium_active=paid_premium_active,
    )


def _active_premium_entitlements(db: Session, user_id: int) -> list[Entitlement]:
    now = datetime.now(timezone.utc)
    return list(
        db.scalars(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.code == "premium",
                Entitlement.starts_at <= now,
                Entitlement.revoked_at.is_(None),
                or_(Entitlement.ends_at.is_(None), Entitlement.ends_at > now),
            )
        ).all()
    )


@router.get("/users", response_model=list[AdminUserOut])
def users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    user_rows = list(
        db.scalars(select(User).order_by(desc(User.created_at)).limit(500)).all()
    )
    entitlements_by_user: dict[int, list[Entitlement]] = {
        user.id: [] for user in user_rows
    }
    if user_rows:
        now = datetime.now(timezone.utc)
        entitlements = db.scalars(
            select(Entitlement).where(
                Entitlement.user_id.in_([user.id for user in user_rows]),
                Entitlement.code == "premium",
                Entitlement.starts_at <= now,
                Entitlement.revoked_at.is_(None),
                or_(Entitlement.ends_at.is_(None), Entitlement.ends_at > now),
            )
        ).all()
        for entitlement in entitlements:
            entitlements_by_user[entitlement.user_id].append(entitlement)
    return [
        _admin_user_out(user, entitlements_by_user[user.id])
        for user in user_rows
    ]


@router.put("/users/{user_id}/access", response_model=AdminUserOut)
def set_user_access(
    user_id: int,
    payload: AdminUserAccessUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.role == "admin":
        raise HTTPException(
            status_code=409,
            detail="Администратор всегда имеет Premium-доступ",
        )

    now = datetime.now(timezone.utc)
    active_entitlements = _active_premium_entitlements(db, user.id)
    active_admin_grants = [
        entitlement
        for entitlement in active_entitlements
        if entitlement.source in ADMIN_PREMIUM_SOURCES
    ]
    changed = False
    if payload.access_level == "premium" and not active_admin_grants:
        db.add(
            Entitlement(
                user_id=user.id,
                code="premium",
                source="admin_override",
                starts_at=now,
                ends_at=None,
            )
        )
        changed = True
    elif payload.access_level == "free" and active_admin_grants:
        for entitlement in active_admin_grants:
            entitlement.revoked_at = now
        changed = True

    audit(
        db,
        admin,
        request,
        "premium.mode.set",
        "user",
        str(user.id),
        {
            "requested_access_level": payload.access_level,
            "admin_grant_changed": changed,
            "paid_access_preserved": any(
                entitlement.source.startswith("payment:")
                for entitlement in active_entitlements
            ),
        },
    )
    db.commit()
    db.refresh(user)
    return _admin_user_out(user, _active_premium_entitlements(db, user.id))


@router.post("/users/{user_id}/grant-premium", status_code=201)
def grant_premium(
    user_id: int,
    days: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if db.get(User, user_id) is None or not 1 <= days <= 3650:
        raise HTTPException(status_code=422, detail="Некорректный пользователь или срок")
    now = datetime.now(timezone.utc)
    entitlement = Entitlement(
        user_id=user_id,
        code="premium",
        source="admin_grant",
        starts_at=now,
        ends_at=now + timedelta(days=days),
    )
    db.add(entitlement)
    audit(db, admin, request, "premium.grant", "user", str(user_id), {"days": days})
    db.commit()
    return {"id": entitlement.id, "ends_at": entitlement.ends_at}


@router.get("/audit-logs")
def audit_logs(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    rows = db.scalars(select(AuditLog).order_by(desc(AuditLog.occurred_at)).limit(200)).all()
    return [
        {
            "id": row.id,
            "occurred_at": row.occurred_at,
            "actor_user_id": row.actor_user_id,
            "action": row.action,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "details": row.details,
        }
        for row in rows
    ]
