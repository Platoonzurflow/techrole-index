"""Add isolated daily aggregates for observed source publications.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("observed_publication_metrics_daily"):
        return
    op.create_table(
        "observed_publication_metrics_daily",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column(
            "source_id", sa.Integer(), sa.ForeignKey("vacancy_sources.id"), nullable=False
        ),
        sa.Column(
            "profession_id", sa.Integer(), sa.ForeignKey("professions.id"), nullable=False
        ),
        sa.Column("seniority_code", sa.String(length=32), nullable=False),
        sa.Column("region_id", sa.Integer(), sa.ForeignKey("regions.id"), nullable=False),
        sa.Column("salary_tax_status", sa.String(length=16), nullable=False),
        sa.Column("normalized_currency", sa.String(length=3), nullable=False),
        sa.Column("publication_count", sa.Integer(), nullable=False),
        sa.Column("salary_disclosed_count", sa.Integer(), nullable=False),
        sa.Column("salary_coverage", sa.Numeric(precision=6, scale=5), nullable=False),
        sa.Column("midpoint_sample_size", sa.Integer(), nullable=False),
        sa.Column("salary_median", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("salary_average", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("salary_p25", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("salary_p75", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("lower_bound_median", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("upper_bound_median", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("confidence_level", sa.String(length=24), nullable=False),
        sa.Column("remote_count", sa.Integer(), nullable=False),
        sa.Column("remote_share", sa.Numeric(precision=6, scale=5), nullable=False),
        sa.Column("last_ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("transform_version", sa.String(length=40), nullable=False),
        sa.Column("transform_run_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "metric_date",
            "source_id",
            "profession_id",
            "seniority_code",
            "region_id",
            "salary_tax_status",
            "normalized_currency",
            name="uq_observed_publication_metric_slice",
        ),
    )
    for column in (
        "metric_date",
        "source_id",
        "profession_id",
        "region_id",
        "transform_run_id",
    ):
        op.create_index(
            f"ix_observed_publication_metrics_daily_{column}",
            "observed_publication_metrics_daily",
            [column],
        )
    op.create_index(
        "ix_observed_publication_source_date",
        "observed_publication_metrics_daily",
        ["source_id", "metric_date"],
    )
    op.create_index(
        "ix_observed_publication_profession_date",
        "observed_publication_metrics_daily",
        ["profession_id", "metric_date"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("observed_publication_metrics_daily"):
        op.drop_table("observed_publication_metrics_daily")
