import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    NotificationRule,
    Profession,
    ProfessionMetricDaily,
    Region,
    SeniorityLevel,
    User,
)
from app.schemas import AlertCreate
from app.security import require_csrf, require_premium

router = APIRouter(tags=["premium"])


@router.get("/export/professions/{slug}.csv")
def export_profession_csv(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_premium),
):
    del user
    profession = db.scalar(select(Profession).where(Profession.slug == slug))
    if profession is None:
        raise HTTPException(status_code=404, detail="Профессия не найдена")
    rows = db.execute(
        select(ProfessionMetricDaily, SeniorityLevel, Region)
        .join(SeniorityLevel, ProfessionMetricDaily.seniority_id == SeniorityLevel.id)
        .join(Region, ProfessionMetricDaily.region_id == Region.id)
        .where(ProfessionMetricDaily.profession_id == profession.id)
        .order_by(ProfessionMetricDaily.metric_date, Region.code, SeniorityLevel.sort_order)
    ).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "date",
            "profession_slug",
            "seniority",
            "region",
            "gross",
            "vacancy_count",
            "salary_count",
            "salary_coverage",
            "salary_median",
            "salary_average",
            "p25",
            "p75",
            "sample_size",
            "confidence",
            "remote_share",
        ]
    )
    for metric, level, region in rows:
        writer.writerow(
            [
                metric.metric_date,
                profession.slug,
                level.code,
                region.code,
                metric.gross,
                metric.vacancy_count,
                metric.salary_count,
                metric.salary_coverage,
                metric.salary_median,
                metric.salary_average,
                metric.salary_p25,
                metric.salary_p75,
                metric.sample_size,
                metric.confidence_level,
                metric.remote_share,
            ]
        )
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{profession.slug}.csv"'},
    )


@router.get("/alerts")
def list_alerts(db: Session = Depends(get_db), user: User = Depends(require_premium)):
    rows = db.execute(
        select(NotificationRule, Profession)
        .join(Profession, NotificationRule.profession_id == Profession.id)
        .where(NotificationRule.user_id == user.id)
        .order_by(NotificationRule.created_at.desc())
    ).all()
    return [
        {
            "id": rule.id,
            "profession_id": profession.id,
            "profession_name": profession.name_ru,
            "metric": rule.metric,
            "direction": rule.direction,
            "threshold_percent": float(rule.threshold_percent),
            "enabled": rule.enabled,
        }
        for rule, profession in rows
    ]


@router.post("/alerts", status_code=201, dependencies=[Depends(require_csrf)])
def create_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_premium),
):
    if db.get(Profession, payload.profession_id) is None:
        raise HTTPException(status_code=404, detail="Профессия не найдена")
    rule = NotificationRule(user_id=user.id, **payload.model_dump())
    db.add(rule)
    db.commit()
    return {"id": rule.id, "status": "created"}


@router.delete("/alerts/{alert_id}", status_code=204, dependencies=[Depends(require_csrf)])
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_premium),
):
    rule = db.scalar(
        select(NotificationRule).where(
            NotificationRule.id == alert_id, NotificationRule.user_id == user.id
        )
    )
    if rule is None:
        raise HTTPException(status_code=404, detail="Правило не найдено")
    db.delete(rule)
    db.commit()
