from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from math import floor
from statistics import fmean, median
from typing import Literal

from app.domain.salary import percentile

SalaryLevel = Literal["junior", "middle", "senior"]


@dataclass(frozen=True)
class SalarySegmentInput:
    lower: Decimal | None
    upper: Decimal | None
    gross: bool | None
    experience_code: str | None


@dataclass(frozen=True)
class SalarySegment:
    seniority: SalaryLevel
    vacancy_count: int
    sample_size: int
    share: float
    median: float | None
    average: float | None
    p25: float | None
    p75: float | None
    confidence_level: str


LEVELS: tuple[SalaryLevel, ...] = ("junior", "middle", "senior")
EXPERIENCE_LEVEL: dict[str, SalaryLevel] = {
    "noexperience": "junior",
    "between1and3": "middle",
    "between3and6": "senior",
    "morethan6": "senior",
}

# The prior is the rounded distribution of experience requirements in the
# current HH IT query-match layer.  It stabilises tiny professions while a
# large role is driven almost entirely by its own vacancies.
EXPERIENCE_PRIOR: dict[SalaryLevel, float] = {
    "junior": 0.15,
    "middle": 0.45,
    "senior": 0.40,
}
EXPERIENCE_PRIOR_STRENGTH = 30


def gross_monthly_from_net(value: Decimal) -> Decimal:
    """Invert the Russian resident employment NDFL scale for a monthly value.

    HH reports a monthly gross/net flag.  The tax brackets are annual, so the
    monthly amount is annualised, inverted piecewise and divided back by 12.
    The calculation intentionally ignores personal deductions and regional
    coefficients: it is a comparable market normalisation, not a payroll quote.
    """

    annual_net = value * Decimal(12)
    brackets = (
        # gross ceiling, tax already paid below the band, marginal rate
        (Decimal("2400000"), Decimal("0"), Decimal("0.13"), Decimal("0")),
        (Decimal("5000000"), Decimal("312000"), Decimal("0.15"), Decimal("2400000")),
        (Decimal("20000000"), Decimal("702000"), Decimal("0.18"), Decimal("5000000")),
        (Decimal("50000000"), Decimal("3402000"), Decimal("0.20"), Decimal("20000000")),
        (None, Decimal("9402000"), Decimal("0.22"), Decimal("50000000")),
    )
    for ceiling, tax_before, rate, floor_gross in brackets:
        if ceiling is None:
            annual_gross = floor_gross + (
                annual_net - (floor_gross - tax_before)
            ) / (Decimal(1) - rate)
            return annual_gross / Decimal(12)
        net_ceiling = ceiling - (
            tax_before + (ceiling - floor_gross) * rate
        )
        if annual_net <= net_ceiling:
            annual_gross = floor_gross + (
                annual_net - (floor_gross - tax_before)
            ) / (Decimal(1) - rate)
            return annual_gross / Decimal(12)
    raise AssertionError("unreachable")


def _gross_value(value: Decimal | None, gross: bool | None) -> Decimal | None:
    if value is None or value <= 0 or gross is None:
        return None
    return value if gross else gross_monthly_from_net(value)


def _allocated_counts(total: int, shares: dict[SalaryLevel, float]) -> dict[SalaryLevel, int]:
    if total <= 0:
        return {level: 0 for level in LEVELS}
    raw = {level: total * shares[level] for level in LEVELS}
    result = {level: floor(raw[level]) for level in LEVELS}
    remainder = total - sum(result.values())
    for level in sorted(LEVELS, key=lambda item: raw[item] - result[item], reverse=True):
        if remainder <= 0:
            break
        result[level] += 1
        remainder -= 1

    minimum = 5 if total >= 15 else 1 if total >= 3 else 0
    for level in LEVELS:
        while result[level] < minimum:
            donor = max(LEVELS, key=lambda item: result[item] - minimum)
            if result[donor] <= minimum:
                break
            result[donor] -= 1
            result[level] += 1
    return result


def _experience_shares(items: Sequence[SalarySegmentInput]) -> dict[SalaryLevel, float]:
    counts = {level: 0 for level in LEVELS}
    classified = 0
    for item in items:
        level = EXPERIENCE_LEVEL.get(str(item.experience_code or "").casefold())
        if level is None:
            continue
        counts[level] += 1
        classified += 1
    denominator = classified + EXPERIENCE_PRIOR_STRENGTH
    return {
        level: (
            counts[level] + EXPERIENCE_PRIOR[level] * EXPERIENCE_PRIOR_STRENGTH
        )
        / denominator
        for level in LEVELS
    }


def _salary_points(items: Sequence[SalarySegmentInput]) -> list[float]:
    normalised: list[tuple[Decimal | None, Decimal | None]] = [
        (_gross_value(item.lower, item.gross), _gross_value(item.upper, item.gross))
        for item in items
    ]
    complete = [(lower, upper) for lower, upper in normalised if lower and upper]
    lower_factors = [float(((lower + upper) / 2) / lower) for lower, upper in complete]
    upper_factors = [float(((lower + upper) / 2) / upper) for lower, upper in complete]
    lower_factor = min(max(median(lower_factors), 1.0), 1.35) if lower_factors else 1.10
    upper_factor = min(max(median(upper_factors), 0.65), 1.0) if upper_factors else 0.90

    points: list[float] = []
    for lower, upper in normalised:
        if lower is not None and upper is not None:
            points.append(float((lower + upper) / 2))
        elif lower is not None:
            points.append(float(lower) * lower_factor)
        elif upper is not None:
            points.append(float(upper) * upper_factor)
    return sorted(points)


def comparable_gross_salary_points(items: Sequence[SalarySegmentInput]) -> list[float]:
    """Return the same exhaustive gross-normalised points used by the band model."""

    return _salary_points(items)


def _confidence(sample_size: int, share: float, minimum: int) -> str:
    if sample_size < minimum:
        return "insufficient"
    if sample_size < minimum * 2:
        return "low"
    if sample_size < minimum * 5 or share < 0.15:
        return "medium"
    return "high"


def build_ranked_salary_segments(
    items: Sequence[SalarySegmentInput],
    *,
    minimum_sample: int = 5,
) -> list[SalarySegment]:
    """Build three exhaustive salary-ranked bands using role-specific HH shares.

    Experience requirements determine how large each band is.  All compatible
    salary disclosures are then normalised to gross RUB, ordered and split into
    contiguous low/middle/high bands.  This keeps the model monotonic while
    retaining the full salary-bearing sample, including one-sided ranges.
    """

    shares = _experience_shares(items)
    points = _salary_points(items)
    salary_counts = _allocated_counts(len(points), shares)
    vacancy_counts = _allocated_counts(len(items), shares)
    result: list[SalarySegment] = []
    offset = 0
    for level in LEVELS:
        count = salary_counts[level]
        values = points[offset : offset + count]
        offset += count
        sample_share = count / len(points) if points else 0.0
        publish = count >= minimum_sample
        result.append(
            SalarySegment(
                seniority=level,
                vacancy_count=vacancy_counts[level],
                sample_size=count,
                share=round(sample_share, 5),
                median=median(values) if publish else None,
                average=fmean(values) if publish else None,
                p25=percentile(values, 0.25) if publish else None,
                p75=percentile(values, 0.75) if publish else None,
                confidence_level=_confidence(count, sample_share, minimum_sample),
            )
        )
    return result
