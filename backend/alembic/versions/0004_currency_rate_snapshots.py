"""Add official currency rate snapshots.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("currency_rate_snapshots"):
        return
    op.create_table(
        "currency_rate_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("requested_date", sa.Date(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("rate_to_rub", sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "provider", "currency", "requested_date", name="uq_currency_rate_snapshot"
        ),
    )
    op.create_index(
        "ix_currency_rate_snapshots_provider", "currency_rate_snapshots", ["provider"]
    )
    op.create_index(
        "ix_currency_rate_snapshots_currency", "currency_rate_snapshots", ["currency"]
    )
    op.create_index(
        "ix_currency_rate_snapshots_requested_date",
        "currency_rate_snapshots",
        ["requested_date"],
    )
    op.create_index(
        "ix_currency_rate_snapshots_effective_date",
        "currency_rate_snapshots",
        ["effective_date"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("currency_rate_snapshots"):
        op.drop_table("currency_rate_snapshots")
