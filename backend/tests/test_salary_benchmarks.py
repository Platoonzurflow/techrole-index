from app.data.catalog import PROFESSIONS
from app.data.salary_benchmarks import (
    SOURCES,
    salary_benchmark_catalog,
    salary_benchmark_for,
    scoring_salary_benchmark,
)
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


def test_related_scopes_are_not_presented_as_exact() -> None:
    analytics_engineer = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for("analytics-engineer", "data-ai")
    )
    sap = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for("sap-developer", "specialized")
    )

    assert analytics_engineer.coverage == "related"
    assert not any(point.scope == "exact_role" for point in analytics_engineer.points)
    assert sap.coverage == "related"
    assert not any(point.scope == "exact_role" for point in sap.points)


def test_related_calculator_medians_cover_nlp_and_sap_without_relabelling() -> None:
    expected = {
        "nlp-engineer": ("data-ai", 230083, "ML разработчик"),
        "sap-developer": ("specialized", 147500, "ERP-программист"),
    }

    for slug, (category, median, label) in expected.items():
        parsed = SalaryBenchmarkSummary.model_validate(
            salary_benchmark_for(slug, category)
        )
        related = next(point for point in parsed.points if point.scope == "related_role")
        source = next(source for source in parsed.sources if source.id == related.source_id)

        assert parsed.coverage == "related"
        assert related.value == median
        assert related.label == label
        assert related.is_fallback is False
        assert related.sample_size is None
        assert source.tax_status == "unknown"
        assert source.url.startswith("https://career.habr.com/salaries?")


def test_public_calculator_medians_expand_exact_role_coverage_without_hidden_values() -> None:
    expected = {
        "qa-manual": 132500,
        "data-scientist": 235541,
        "mlops-engineer": 351666,
        "computer-vision-engineer": 172500,
        "information-security-specialist": 168036,
        "security-engineer": 207333,
        "soc-analyst": 146000,
        "penetration-tester": 170833,
    }
    categories = {slug: category for slug, _, _, category, _ in PROFESSIONS}

    for slug, median in expected.items():
        parsed = SalaryBenchmarkSummary.model_validate(
            salary_benchmark_for(slug, categories[slug])
        )
        direct = next(point for point in parsed.points if point.scope == "exact_role")
        source = next(source for source in parsed.sources if source.id == direct.source_id)

        assert parsed.coverage == "direct"
        assert direct.value == median
        assert direct.p10 is None and direct.p90 is None and direct.sample_size is None
        assert source.tax_status == "unknown"
        assert source.total_sample_size is None
        assert source.url.startswith("https://career.habr.com/salaries?")
        assert "qualification=All" in source.url


def test_salary_coverage_counts_are_versioned() -> None:
    coverage = [
        salary_benchmark_for(slug, category)["coverage"]
        for slug, _, _, category, _ in PROFESSIONS
    ]
    assert coverage.count("direct") == 37
    assert coverage.count("related") == 13
    assert coverage.count("category") == 0


def test_small_samples_and_unknown_tax_status_remain_visible() -> None:
    parsed = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for("dotnet-developer", "development")
    )
    middle = next(point for point in parsed.points if point.seniority == "middle")
    source = next(source for source in parsed.sources if source.id == middle.source_id)

    assert middle.sample_size == 6
    assert "выброс" in (middle.note or "")
    assert source.tax_status == "unknown"


def test_every_role_has_one_complete_coherent_grade_fallback_family() -> None:
    categories = {slug: category for slug, _, _, category, _ in PROFESSIONS}
    for slug, category in categories.items():
        parsed = SalaryBenchmarkSummary.model_validate(salary_benchmark_for(slug, category))
        fallback_levels = [
            point
            for point in parsed.points
            if point.is_fallback and point.scope == "market_level"
        ]
        assert [point.seniority for point in fallback_levels] == [
            "junior",
            "middle",
            "senior",
        ]
        representatives: list[float] = []
        for point in fallback_levels:
            if point.value is not None:
                representatives.append(point.value)
            else:
                assert point.lower is not None and point.upper is not None
                representatives.append((point.lower + point.upper) / 2)
        assert representatives == sorted(representatives)


def test_sources_use_https_and_have_methodology() -> None:
    for source in SOURCES.values():
        assert source["url"].startswith("https://")
        assert source["methodology_url"].startswith("https://")
        assert source["methodology_note"]


def test_salary_benchmark_catalog_exports_every_profession() -> None:
    catalog = salary_benchmark_catalog()

    assert len(catalog) == 50
    assert len({item["slug"] for item in catalog}) == 50
    assert {item["benchmark"]["coverage"] for item in catalog} == {"direct", "related"}
    assert sum(item["benchmark"]["coverage"] == "direct" for item in catalog) == 37
    assert sum(item["benchmark"]["coverage"] == "related" for item in catalog) == 13
    assert all(item["benchmark"]["points"] for item in catalog)
    assert all(item["benchmark"]["sources"] for item in catalog)
    assert all(
        {
            point["seniority"]
            for point in item["benchmark"]["points"]
            if point["seniority"] is not None
        }
        == {"junior", "middle", "senior"}
        for item in catalog
    )


def test_rosstat_occupation_context_is_visible_and_never_relabelled_as_role() -> None:
    expected = {
        ("dotnet-developer", "development"): (
            "Разработчики и аналитики ПО и приложений",
            216348,
        ),
        ("devops-engineer", "infrastructure"): (
            "Специалисты по базам данных и сетям",
            165966,
        ),
        ("security-engineer", "security"): (
            "Специалисты высшего уровня в ИКТ",
            202029,
        ),
    }

    for (slug, category), (label, value) in expected.items():
        parsed = SalaryBenchmarkSummary.model_validate(
            salary_benchmark_for(slug, category)
        )
        point = next(
            item
            for item in parsed.points
            if item.source_id == "rosstat_57t_2025"
        )
        assert point.scope == "occupation_group"
        assert point.label == label
        assert point.metric == "average"
        assert point.value == value
        assert point.is_fallback is False
        assert "не зарплата конкретной профессии" in (point.note or "").lower()


def test_scoring_salary_prefers_direct_public_point_over_broad_context() -> None:
    payload = SalaryBenchmarkSummary.model_validate(
        salary_benchmark_for("dotnet-developer", "development")
    )
    direct = next(point for point in payload.points if point.scope == "technology")

    assert direct.value is not None
    assert scoring_salary_benchmark("dotnet-developer", "development") == direct.value
