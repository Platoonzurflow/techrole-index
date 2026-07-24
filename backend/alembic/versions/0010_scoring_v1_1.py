"""Activate the recalibrated career index.

Revision ID: 0010
Revises: 0009
"""

from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

VERSION = "v1.1.0"
WEIGHTS = {
    "demand": 0.28,
    "salary": 0.24,
    "demand_growth": 0.16,
    "junior_access": 0.12,
    "remote_share": 0.10,
    "data_quality": 0.10,
}


def upgrade() -> None:
    bind = op.get_bind()
    table = sa.table(
        "scoring_versions",
        sa.column("id", sa.Integer),
        sa.column("version", sa.String),
        sa.column("weights", sa.JSON),
        sa.column("description", sa.Text),
        sa.column("is_active", sa.Boolean),
        sa.column("created_by_user_id", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    bind.execute(table.update().values(is_active=False))
    existing = bind.execute(
        sa.select(table.c.id).where(table.c.version == VERSION)
    ).scalar_one_or_none()
    if existing is None:
        now = datetime.now(timezone.utc)
        bind.execute(
            table.insert().values(
                version=VERSION,
                weights=WEIGHTS,
                description=(
                    "Career index: prepared demand/growth/access/remote, "
                    "public salary benchmark and stronger data-quality weight; "
                    "see METHODOLOGY.md."
                ),
                is_active=True,
                created_by_user_id=None,
                created_at=now,
                updated_at=now,
            )
        )
    else:
        bind.execute(
            table.update()
            .where(table.c.id == existing)
            .values(weights=WEIGHTS, is_active=True)
        )


def downgrade() -> None:
    bind = op.get_bind()
    table = sa.table(
        "scoring_versions",
        sa.column("id", sa.Integer),
        sa.column("version", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    bind.execute(table.update().where(table.c.version == VERSION).values(is_active=False))
    bind.execute(
        table.update().where(table.c.version == "v1.0.0").values(is_active=True)
    )
