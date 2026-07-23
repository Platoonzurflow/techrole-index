"""Snapshot the server product definition on each payment order.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("payment_orders"):
        return
    columns = {column["name"] for column in inspector.get_columns("payment_orders")}
    if "product_snapshot" not in columns:
        op.add_column(
            "payment_orders",
            sa.Column(
                "product_snapshot",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'{}'"),
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("payment_orders"):
        return
    columns = {column["name"] for column in inspector.get_columns("payment_orders")}
    if "product_snapshot" in columns:
        op.drop_column("payment_orders", "product_snapshot")
