from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command
from app.config import settings


def test_migration_up_and_down(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'migration.sqlite3'}"
    original = settings.database_url
    settings.database_url = database_url
    config = Config("alembic.ini")
    try:
        command.upgrade(config, "head")
        inspector = inspect(create_engine(database_url))
        tables = set(inspector.get_table_names())
        assert {
            "professions",
            "vacancies",
            "profession_metrics_daily",
            "users",
            "audit_logs",
            "support_requests",
            "mentorship_requests",
            "currency_rate_snapshots",
            "observed_publication_metrics_daily",
            "payment_orders",
            "payment_refunds",
        } <= tables
        mentorship_columns = {
            column["name"] for column in inspector.get_columns("mentorship_requests")
        }
        assert "proposed_budget_rub" in mentorship_columns
        command.downgrade(config, "base")
        assert inspect(create_engine(database_url)).get_table_names() == ["alembic_version"]
    finally:
        settings.database_url = original
