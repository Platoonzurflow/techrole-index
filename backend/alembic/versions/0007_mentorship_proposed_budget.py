"""Add proposed budget to mentorship requests.

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("mentorship_requests"):
        return
    columns = {column["name"] for column in inspector.get_columns("mentorship_requests")}
    if "proposed_budget_rub" not in columns:
        op.add_column(
            "mentorship_requests",
            sa.Column("proposed_budget_rub", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("mentorship_requests"):
        return
    columns = {column["name"] for column in inspector.get_columns("mentorship_requests")}
    if "proposed_budget_rub" in columns:
        op.drop_column("mentorship_requests", "proposed_budget_rub")
