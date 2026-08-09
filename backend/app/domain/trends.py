from dataclasses import dataclass
from statistics import fmean


@dataclass(frozen=True)
class Trend:
    period_days: int
    current_average: float | None
    previous_average: float | None
    change_percent: float | None
    direction: str


def calculate_trend(
    values: list[float | None], period_days: int = 7, threshold: float = 3.0
) -> Trend:
    clean_current = [float(v) for v in values[-period_days:] if v is not None]
    clean_previous = [float(v) for v in values[-period_days * 2 : -period_days] if v is not None]
    if not clean_current or not clean_previous:
        return Trend(period_days, None, None, None, "unknown")
    current = fmean(clean_current)
    previous = fmean(clean_previous)
    comparison_base = max(abs(current), abs(previous))
    if comparison_base == 0:
        change = 0.0
    else:
        # Use the larger adjacent-window average as the base. Demand and salary
        # are non-negative, so this keeps the public change scale intuitive and
        # bounded. The clamp also protects the contract if a signed metric is
        # ever passed here later.
        change = max(-100.0, min(100.0, ((current - previous) / comparison_base) * 100))
    direction = "up" if change > threshold else "down" if change < -threshold else "neutral"
    return Trend(period_days, current, previous, round(change, 2), direction)


def calculate_all_trends(values: list[float | None]) -> dict[str, Trend]:
    return {str(period): calculate_trend(values, period) for period in (7, 30, 90)}
