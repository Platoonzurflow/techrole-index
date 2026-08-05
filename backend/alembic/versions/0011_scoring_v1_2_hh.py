"""Activate profession-specific HH scoring.

Revision ID: 0011
Revises: 0010
"""

from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

VERSION = "v1.2.0"
WEIGHTS = {
    "demand": 0.28,
    "salary": 0.24,
    "demand_growth": 0.16,
    "junior_access": 0.12,
    "remote_share": 0.10,
    "data_quality": 0.10,
}
DESCRIPTION = (
    "Career index from profession-specific HH observations: demand, 14-day growth, "
    "junior access, remote share and data quality; own gross RUB salary median at "
    "n>=5, otherwise a neutral peer median; see METHODOLOGY.md."
)


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
                description=DESCRIPTION,
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
            .values(weights=WEIGHTS, description=DESCRIPTION, is_active=True)
        )


def downgrade() -> None:
    bind = op.get_bind()
    table = sa.table(
        "scoring_versions",
        sa.column("version", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    bind.execute(table.update().where(table.c.version == VERSION).values(is_active=False))
    bind.execute(
        table.update().where(table.c.version == "v1.1.0").values(is_active=True)
    )
