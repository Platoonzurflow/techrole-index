"""Add persisted support requests.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("support_requests"):
        return
    op.create_table(
        "support_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("topic", sa.String(length=40), nullable=False),
        sa.Column("subject", sa.String(length=180), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("delivery_attempts", sa.Integer(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=160), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("public_id", name="uq_support_requests_public_id"),
    )
    op.create_index("ix_support_requests_public_id", "support_requests", ["public_id"])
    op.create_index("ix_support_requests_user_id", "support_requests", ["user_id"])
    op.create_index("ix_support_requests_email", "support_requests", ["email"])
    op.create_index("ix_support_requests_topic", "support_requests", ["topic"])
    op.create_index("ix_support_requests_status", "support_requests", ["status"])
    op.create_index("ix_support_requests_ip_hash", "support_requests", ["ip_hash"])


def downgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("support_requests"):
        op.drop_table("support_requests")
