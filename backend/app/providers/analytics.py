from typing import Any, Protocol


class AnalyticsSink(Protocol):
    """Extension point for a future ClickHouse sink."""

    def write_metrics(self, rows: list[dict[str, Any]]) -> None: ...


class PostgresAnalyticsSink:
    def __init__(self, session):
        self.session = session

    def write_metrics(self, rows: list[dict[str, Any]]) -> None:
        from app.models import ProfessionMetricDaily

        self.session.bulk_insert_mappings(ProfessionMetricDaily, rows)
