from app.data.catalog import PROFESSIONS
from app.data.salary_benchmarks import SOURCES, salary_benchmark_for
from app.schemas import SalaryBenchmarkSummary


def test_every_catalog_profession_has_a_sourced_salary_fallback() -> None:
    for slug, _, _, category_slug, _ in PROFESSIONS:
        payload = salary_benchmark_for(slug, category_slug)
        parsed = SalaryBenchmarkSummary.model_validate(payload)

        category_points = [point for point in parsed.points if point.scope == "category"]
        assert {point.geography for point in category_points} == {
            "russia",
            "moscow",
            "saint_petersburg",
            "regions",
        }
        assert all(point.value is not None and point.is_fallback for point in category_points)
        assert parsed.sources


def test_direct_distribution_keeps_percentiles_and_tax_status() -> None:
    parsed = SalaryBenchmarkSummary.model_validate(salary_benchmark_for("data-engineer", "data-ai"))
    direct = next(point for point in parsed.points if point.scope == "exact_role")

    assert parsed.coverage == "direct"
    assert direct.value == 240000
    assert direct.p10 == 100000
    assert direct.p90 == 413000
    assert parsed.sources[0].tax_status == "net"
    assert parsed.sources[0].total_sample_size == 45226


def test_related_and_category_scopes_are_not_presented_as_exact() -> None:
    analytics_engineer = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for("analytics-engineer", "data-ai")
    )
    sap = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for("sap-developer", "specialized")
    )

    assert analytics_engineer.coverage == "related"
    assert not any(point.scope == "exact_role" for point in analytics_engineer.points)
    assert sap.coverage == "category"
    assert all(point.is_fallback for point in sap.points)


def test_small_samples_and_unknown_tax_status_remain_visible() -> None:
    parsed = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for("dotnet-developer", "development")
    )
    middle = next(point for point in parsed.points if point.seniority == "middle")
    source = next(source for source in parsed.sources if source.id == middle.source_id)

    assert middle.sample_size == 6
    assert "выброс" in (middle.note or "")
    assert source.tax_status == "unknown"


def test_sources_use_https_and_have_methodology() -> None:
    for source in SOURCES.values():
        assert source["url"].startswith("https://")
        assert source["methodology_url"].startswith("https://")
        assert source["methodology_note"]
