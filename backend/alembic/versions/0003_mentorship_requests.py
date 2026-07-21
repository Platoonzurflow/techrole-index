"""Add persisted mentorship requests.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("mentorship_requests"):
        return
    op.create_table(
        "mentorship_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("contact", sa.String(length=320), nullable=False),
        sa.Column("direction", sa.String(length=80), nullable=False),
        sa.Column("level", sa.String(length=80), nullable=False),
        sa.Column("context", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("delivery_attempts", sa.Integer(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=160), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("public_id", name="uq_mentorship_requests_public_id"),
    )
    op.create_index("ix_mentorship_requests_public_id", "mentorship_requests", ["public_id"])
    op.create_index("ix_mentorship_requests_user_id", "mentorship_requests", ["user_id"])
    op.create_index("ix_mentorship_requests_contact", "mentorship_requests", ["contact"])
    op.create_index("ix_mentorship_requests_direction", "mentorship_requests", ["direction"])
    op.create_index("ix_mentorship_requests_level", "mentorship_requests", ["level"])
    op.create_index("ix_mentorship_requests_status", "mentorship_requests", ["status"])
    op.create_index("ix_mentorship_requests_ip_hash", "mentorship_requests", ["ip_hash"])


def downgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("mentorship_requests"):
        op.drop_table("mentorship_requests")
