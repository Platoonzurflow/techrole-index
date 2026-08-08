from decimal import Decimal

import pytest

from app.domain.salary_segments import (
    SalarySegmentInput,
    build_ranked_salary_segments,
    gross_monthly_from_net,
)


def item(
    value: int,
    experience: str,
    *,
    gross: bool = True,
    upper: int | None = None,
) -> SalarySegmentInput:
    return SalarySegmentInput(
        lower=Decimal(value),
        upper=Decimal(upper) if upper is not None else None,
        gross=gross,
        experience_code=experience,
    )


@pytest.mark.parametrize(
    ("gross", "net"),
    [
        (200_000, 174_000),
        (300_000, 259_000),
        (500_000, 426_500),
    ],
)
def test_progressive_net_salary_is_inverted_to_monthly_gross(gross: int, net: int) -> None:
    assert float(gross_monthly_from_net(Decimal(net))) == pytest.approx(gross)


def test_ranked_segments_use_every_salary_and_follow_experience_mix() -> None:
    items = [
        *[item(value, "noExperience") for value in range(50_000, 150_000, 10_000)],
        *[item(value, "between1And3") for value in range(150_000, 450_000, 10_000)],
        *[item(value, "between3And6") for value in range(450_000, 650_000, 10_000)],
    ]
    segments = build_ranked_salary_segments(items)

    assert sum(segment.sample_size for segment in segments) == len(items)
    assert segments[0].sample_size < segments[1].sample_size
    assert segments[0].median < segments[1].median < segments[2].median
    assert all(segment.confidence_level != "insufficient" for segment in segments)


def test_one_sided_and_net_ranges_remain_in_the_sample() -> None:
    items = [
        item(100_000 + index * 5_000, "between1And3", gross=index % 2 == 0)
        for index in range(20)
    ] + [
        item(90_000, "noExperience", upper=120_000),
        SalarySegmentInput(None, Decimal("700000"), True, "moreThan6"),
    ]
    segments = build_ranked_salary_segments(items)

    assert sum(segment.sample_size for segment in segments) == len(items)
    assert all(segment.sample_size >= 5 for segment in segments)


def test_unknown_tax_basis_is_not_silently_mixed() -> None:
    items = [item(100_000 + index * 10_000, "between1And3") for index in range(15)]
    items.append(SalarySegmentInput(Decimal("999999"), None, None, "moreThan6"))

    segments = build_ranked_salary_segments(items)

    assert sum(segment.sample_size for segment in segments) == 15
