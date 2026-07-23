from decimal import Decimal

from app.domain.salary import SalaryInput, calculate_salary_statistics


def test_midpoint_requires_both_bounds_and_respects_minimum_sample():
    observations = [SalaryInput(Decimal("100000"), Decimal("200000"), True) for _ in range(20)]
    observations += [
        SalaryInput(Decimal("250000"), None, True),
        SalaryInput(None, Decimal("300000"), True),
    ]
    result = calculate_salary_statistics(
        observations, total_vacancies=40, min_sample=20, gross=True
    )
    assert result.midpoint_sample_size == 20
    assert result.salary_count == 22
    assert result.salary_coverage == 0.55
    assert result.median == 150000
    assert result.lower_bound_median == 100000
    assert result.upper_bound_median == 200000


def test_gross_and_net_are_never_mixed():
    rows = [SalaryInput(Decimal("100"), Decimal("200"), True) for _ in range(20)]
    rows += [SalaryInput(Decimal("1000"), Decimal("2000"), False) for _ in range(20)]
    gross = calculate_salary_statistics(rows, min_sample=20, gross=True)
    net = calculate_salary_statistics(rows, min_sample=20, gross=False)
    assert gross.median == 150
    assert net.median == 1500


def test_insufficient_sample_hides_midpoint_statistics():
    rows = [SalaryInput(Decimal("100"), Decimal("200"), True) for _ in range(19)]
    result = calculate_salary_statistics(rows, min_sample=20)
    assert result.confidence_level == "insufficient"
    assert result.median is None
    assert result.average is None


def test_three_complete_ranges_are_published_by_default():
    rows = [
        SalaryInput(Decimal("100000"), Decimal("140000"), True),
        SalaryInput(Decimal("120000"), Decimal("160000"), True),
        SalaryInput(Decimal("140000"), Decimal("180000"), True),
    ]

    result = calculate_salary_statistics(rows)

    assert result.midpoint_sample_size == 3
    assert result.median == 140000
    assert result.average == 140000
    assert result.confidence_level == "low"
