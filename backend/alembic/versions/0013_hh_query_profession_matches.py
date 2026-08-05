"""Store many-to-many HH query matches.

Revision ID: 0013
Revises: 0012
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Revision 0001 intentionally creates the current ORM metadata on a brand-new
    # database. Existing installations do not have this table yet, while fresh
    # migration-test databases do.
    if sa.inspect(op.get_bind()).has_table("vacancy_profession_matches"):
        return
    op.create_table(
        "vacancy_profession_matches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("vacancy_id", sa.Integer(), nullable=False),
        sa.Column("profession_id", sa.Integer(), nullable=False),
        sa.Column("last_run_id", sa.Integer(), nullable=False),
        sa.Column("match_method", sa.String(length=80), nullable=False),
        sa.Column("matched_queries", sa.JSON(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["last_run_id"], ["ingestion_runs.id"]),
        sa.ForeignKeyConstraint(["profession_id"], ["professions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vacancy_id"], ["vacancies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "vacancy_id", "profession_id", name="uq_vacancy_profession_match"
        ),
    )
    op.create_index(
        "ix_vacancy_profession_matches_vacancy_id",
        "vacancy_profession_matches",
        ["vacancy_id"],
    )
    op.create_index(
        "ix_vacancy_profession_matches_profession_id",
        "vacancy_profession_matches",
        ["profession_id"],
    )
    op.create_index(
        "ix_vacancy_profession_matches_last_run_id",
        "vacancy_profession_matches",
        ["last_run_id"],
    )
    op.create_index(
        "ix_vacancy_profession_match_run",
        "vacancy_profession_matches",
        ["last_run_id", "profession_id"],
    )


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("vacancy_profession_matches"):
        return
    op.drop_index(
        "ix_vacancy_profession_match_run",
        table_name="vacancy_profession_matches",
    )
    op.drop_index(
        "ix_vacancy_profession_matches_last_run_id",
        table_name="vacancy_profession_matches",
    )
    op.drop_index(
        "ix_vacancy_profession_matches_profession_id",
        table_name="vacancy_profession_matches",
    )
    op.drop_index(
        "ix_vacancy_profession_matches_vacancy_id",
        table_name="vacancy_profession_matches",
    )
    op.drop_table("vacancy_profession_matches")
