"""Add auditable payment orders and refunds.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "payment_orders" not in tables:
        op.create_table(
            "payment_orders",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("public_id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("product_code", sa.String(length=80), nullable=False),
            sa.Column("provider", sa.String(length=60), nullable=False),
            sa.Column("external_payment_id", sa.String(length=160), nullable=True),
            sa.Column("client_idempotency_key", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False),
            sa.Column("description", sa.String(length=180), nullable=False),
            sa.Column("terms_version", sa.String(length=80), nullable=False),
            sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("confirmation_url", sa.Text(), nullable=True),
            sa.Column("is_test", sa.Boolean(), nullable=False),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("public_id", name="uq_payment_orders_public_id"),
            sa.UniqueConstraint(
                "external_payment_id", name="uq_payment_orders_external_payment_id"
            ),
            sa.UniqueConstraint(
                "user_id",
                "client_idempotency_key",
                name="uq_payment_order_user_idempotency",
            ),
        )
        for column in ("public_id", "user_id", "product_code", "provider", "status"):
            op.create_index(f"ix_payment_orders_{column}", "payment_orders", [column])

    tables = set(inspect(bind).get_table_names())
    if "payment_refunds" not in tables:
        op.create_table(
            "payment_refunds",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("public_id", sa.String(length=36), nullable=False),
            sa.Column(
                "payment_order_id",
                sa.Integer(),
                sa.ForeignKey("payment_orders.id"),
                nullable=False,
            ),
            sa.Column("provider", sa.String(length=60), nullable=False),
            sa.Column("external_refund_id", sa.String(length=160), nullable=True),
            sa.Column("idempotency_key", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False),
            sa.Column("reason", sa.String(length=180), nullable=False),
            sa.Column("succeeded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("public_id", name="uq_payment_refunds_public_id"),
            sa.UniqueConstraint(
                "external_refund_id", name="uq_payment_refunds_external_refund_id"
            ),
            sa.UniqueConstraint("idempotency_key", name="uq_payment_refunds_idempotency_key"),
        )
        for column in ("public_id", "payment_order_id", "provider", "status"):
            op.create_index(f"ix_payment_refunds_{column}", "payment_refunds", [column])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "payment_refunds" in tables:
        op.drop_table("payment_refunds")
    if "payment_orders" in tables:
        op.drop_table("payment_orders")
