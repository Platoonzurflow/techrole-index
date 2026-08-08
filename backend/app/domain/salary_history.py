from __future__ import annotations

from typing import Any, Literal

SalaryHistorySeniority = Literal["junior", "middle", "senior"]
SalaryHistoryReferenceScope = Literal[
    "exact_role", "related_role", "technology", "category", "market_level"
]

SALARY_HISTORY_MINIMUM_RATIO: dict[SalaryHistorySeniority, float] = {
    "junior": 0.4,
    "middle": 0.7,
    "senior": 1.0,
}
SALARY_HISTORY_WINDOW_DAYS = 30
SALARY_HISTORY_MINIMUM_SOURCE_DATES = 3


def salary_history_reference(
    benchmark: dict[str, Any],
) -> tuple[float, SalaryHistoryReferenceScope]:
    """Choose the visible national median used to trim implausibly low points."""
    points = benchmark["points"]
    for scope in (
        "exact_role",
        "technology",
        "related_role",
        "category",
        "market_level",
    ):
        point = next(
            (
                item
                for item in points
                if item["scope"] == scope
                and item["geography"] == "russia"
                and item["seniority"] is None
                and item["metric"] == "median"
                and item["value"] is not None
            ),
            None,
        )
        if point is not None:
            return float(point["value"]), scope
    raise ValueError("Salary benchmark has no national median reference")
