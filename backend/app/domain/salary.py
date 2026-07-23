from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal
from statistics import fmean, median


@dataclass(frozen=True)
class SalaryInput:
    lower: Decimal | None
    upper: Decimal | None
    gross: bool | None


@dataclass(frozen=True)
class SalaryStatistics:
    vacancy_count: int
    salary_count: int
    salary_coverage: float
    midpoint_sample_size: int
    median: float | None
    average: float | None
    p25: float | None
    p75: float | None
    lower_bound_median: float | None
    upper_bound_median: float | None
    confidence_level: str


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def calculate_salary_statistics(
    observations: Iterable[SalaryInput],
    *,
    total_vacancies: int | None = None,
    min_sample: int = 3,
    gross: bool | None = True,
) -> SalaryStatistics:
    all_items = list(observations)
    # Unknown tax basis is a separate group; it is never silently mixed with gross/net.
    items = [item for item in all_items if item.gross is gross]
    salary_items = [item for item in items if item.lower is not None or item.upper is not None]
    midpoints = [
        float((item.lower + item.upper) / 2)
        for item in items
        if item.lower is not None and item.upper is not None
    ]
    lowers = [float(item.lower) for item in items if item.lower is not None]
    uppers = [float(item.upper) for item in items if item.upper is not None]
    vacancy_count = total_vacancies if total_vacancies is not None else len(items)
    coverage = len(salary_items) / vacancy_count if vacancy_count else 0.0
    if len(midpoints) < min_sample:
        confidence = "insufficient"
    elif len(midpoints) < min_sample * 2 or coverage < 0.35:
        confidence = "low"
    elif len(midpoints) < min_sample * 5 or coverage < 0.6:
        confidence = "medium"
    else:
        confidence = "high"
    publish = len(midpoints) >= min_sample
    return SalaryStatistics(
        vacancy_count=vacancy_count,
        salary_count=len(salary_items),
        salary_coverage=round(coverage, 5),
        midpoint_sample_size=len(midpoints),
        median=median(midpoints) if publish else None,
        average=fmean(midpoints) if publish else None,
        p25=percentile(midpoints, 0.25) if publish else None,
        p75=percentile(midpoints, 0.75) if publish else None,
        lower_bound_median=median(lowers) if lowers else None,
        upper_bound_median=median(uppers) if uppers else None,
        confidence_level=confidence,
    )
