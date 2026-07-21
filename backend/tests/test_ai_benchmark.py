from app.ai_benchmark import BenchmarkSuite, load_suite, score_results
from app.domain.classifier import Classification


def result(slug: str | None, seniority: str | None) -> Classification:
    return Classification(slug, seniority, 0.79, ("benchmark",))


def test_checked_in_ai_benchmark_suite_is_valid() -> None:
    suite = load_suite(__import__("app.ai_benchmark").ai_benchmark.default_cases_path())

    assert len(suite.cases) == 20
    assert sum(case.expected_slugs == [None] for case in suite.cases) == 3


def test_ai_benchmark_scoring_requires_valid_abstentions() -> None:
    suite = BenchmarkSuite.model_validate(
        {
            "schema_version": "1.0",
            "description": "test",
            "thresholds": {
                "schema_valid_rate": 1,
                "slug_accuracy": 1,
                "seniority_accuracy": 1,
                "exact_accuracy": 1,
                "abstention_accuracy": 1,
            },
            "cases": [
                {
                    "id": "role",
                    "title": "role",
                    "expected_slugs": ["python-developer"],
                    "expected_seniorities": ["middle"],
                },
                {
                    "id": "abstain",
                    "title": "not a role",
                    "expected_slugs": [None],
                    "expected_seniorities": [None],
                },
            ],
        }
    )

    perfect = score_results(suite, [result("python-developer", "middle"), result(None, None)])
    invalid_abstention = score_results(suite, [result("python-developer", "middle"), None])

    assert perfect["passed"] is True
    assert perfect["abstention_accuracy"] == 1
    assert invalid_abstention["passed"] is False
    assert invalid_abstention["schema_valid_rate"] == 0.5
    assert invalid_abstention["abstention_accuracy"] == 0
