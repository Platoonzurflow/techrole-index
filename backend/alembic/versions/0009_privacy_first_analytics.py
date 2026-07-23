"""Add privacy-first human and crawler analytics events.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("analytics_events"):
        return
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("visitor_hash", sa.String(length=64), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("category", sa.String(length=24), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("target_path", sa.String(length=512), nullable=True),
        sa.Column("referrer_host", sa.String(length=255), nullable=True),
        sa.Column("crawler_name", sa.String(length=64), nullable=True),
    )
    for column in (
        "event_date",
        "occurred_at",
        "visitor_hash",
        "user_id",
        "category",
        "event_type",
        "path",
        "referrer_host",
        "crawler_name",
    ):
        op.create_index(f"ix_analytics_events_{column}", "analytics_events", [column])
    op.create_index(
        "ix_analytics_event_date_category",
        "analytics_events",
        ["event_date", "category"],
    )
    op.create_index(
        "ix_analytics_event_date_type",
        "analytics_events",
        ["event_date", "event_type"],
    )


def downgrade() -> None:
    if inspect(op.get_bind()).has_table("analytics_events"):
        op.drop_table("analytics_events")
