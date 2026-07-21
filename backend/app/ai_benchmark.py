from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.config import Settings
from app.data.catalog import PROFESSIONS
from app.domain.classifier import Classification
from app.providers.ai import OllamaOptionalClassifier

Seniority = Literal["junior", "middle", "senior"]


class BenchmarkThresholds(BaseModel):
    schema_valid_rate: float = Field(ge=0, le=1)
    slug_accuracy: float = Field(ge=0, le=1)
    seniority_accuracy: float = Field(ge=0, le=1)
    exact_accuracy: float = Field(ge=0, le=1)
    abstention_accuracy: float = Field(ge=0, le=1)


class BenchmarkCase(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = ""
    expected_slugs: list[str | None] = Field(min_length=1)
    expected_seniorities: list[Seniority | None] = Field(min_length=1)


class BenchmarkSuite(BaseModel):
    schema_version: Literal["1.0"]
    description: str
    thresholds: BenchmarkThresholds
    cases: list[BenchmarkCase] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_cases(self) -> BenchmarkSuite:
        case_ids = [case.id for case in self.cases]
        if len(case_ids) != len(set(case_ids)):
            raise ValueError("Benchmark case ids must be unique")
        allowed_slugs = {profession[0] for profession in PROFESSIONS}
        unknown = {
            slug
            for case in self.cases
            for slug in case.expected_slugs
            if slug is not None and slug not in allowed_slugs
        }
        if unknown:
            raise ValueError(f"Unknown benchmark profession slugs: {sorted(unknown)}")
        return self


def default_cases_path() -> Path:
    return Path(__file__).with_name("data") / "ai_classifier_benchmark.json"


def load_suite(path: Path) -> BenchmarkSuite:
    return BenchmarkSuite.model_validate_json(path.read_text(encoding="utf-8"))


def score_results(
    suite: BenchmarkSuite,
    results: list[Classification | None],
) -> dict[str, float | int | bool]:
    if len(results) != len(suite.cases):
        raise ValueError("Result count must match benchmark case count")

    total = len(suite.cases)
    schema_valid = 0
    slug_matches = 0
    seniority_matches = 0
    exact_matches = 0
    abstention_total = 0
    abstention_matches = 0

    for case, result in zip(suite.cases, results, strict=True):
        expects_abstention = case.expected_slugs == [None]
        abstention_total += int(expects_abstention)
        if result is None:
            continue
        schema_valid += 1
        slug_matches += int(result.profession_slug in case.expected_slugs)
        seniority_matches += int(result.seniority in case.expected_seniorities)
        exact_matches += int(
            result.profession_slug in case.expected_slugs
            and result.seniority in case.expected_seniorities
        )
        abstention_matches += int(expects_abstention and result.profession_slug is None)

    rates = {
        "schema_valid_rate": schema_valid / total,
        "slug_accuracy": slug_matches / total,
        "seniority_accuracy": seniority_matches / total,
        "exact_accuracy": exact_matches / total,
        "abstention_accuracy": (
            abstention_matches / abstention_total if abstention_total else 1.0
        ),
    }
    threshold_values = suite.thresholds.model_dump()
    return {
        "case_count": total,
        "schema_valid_count": schema_valid,
        "slug_match_count": slug_matches,
        "seniority_match_count": seniority_matches,
        "exact_match_count": exact_matches,
        "abstention_case_count": abstention_total,
        "abstention_match_count": abstention_matches,
        **rates,
        "passed": all(rates[name] >= value for name, value in threshold_values.items()),
    }


def run_benchmark(
    suite: BenchmarkSuite,
    *,
    model: str,
    base_url: str,
    timeout_seconds: int,
) -> dict[str, object]:
    settings = Settings(
        ai_classifier_enabled=True,
        ollama_model=model,
        ollama_base_url=base_url,
        ai_classifier_timeout_seconds=timeout_seconds,
    )
    allowed_slugs = {profession[0] for profession in PROFESSIONS}
    classifier = OllamaOptionalClassifier(settings, allowed_slugs)
    results: list[Classification | None] = []
    case_reports: list[dict[str, object]] = []
    started = perf_counter()

    try:
        for case in suite.cases:
            case_started = perf_counter()
            error: str | None = None
            try:
                result = classifier.classify(case.title, case.description)
            except Exception as exc:  # benchmark must continue and report every case
                result = None
                error = type(exc).__name__
            results.append(result)
            case_reports.append(
                {
                    "id": case.id,
                    "expected_slugs": case.expected_slugs,
                    "expected_seniorities": case.expected_seniorities,
                    "actual_slug": result.profession_slug if result else None,
                    "actual_seniority": result.seniority if result else None,
                    "confidence": result.confidence if result else None,
                    "schema_valid": result is not None,
                    "slug_match": result is not None
                    and result.profession_slug in case.expected_slugs,
                    "seniority_match": result is not None
                    and result.seniority in case.expected_seniorities,
                    "latency_seconds": round(perf_counter() - case_started, 3),
                    "error": error,
                }
            )
    finally:
        classifier.unload()

    return {
        "schema_version": suite.schema_version,
        "generated_at": datetime.now(UTC).isoformat(),
        "model": model,
        "base_url": base_url,
        "synthetic_cases": True,
        "thresholds": suite.thresholds.model_dump(),
        "metrics": score_results(suite, results),
        "duration_seconds": round(perf_counter() - started, 3),
        "cases": case_reports,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the optional Ollama classifier against synthetic domain cases."
    )
    parser.add_argument("--cases", type=Path, default=default_cases_path())
    parser.add_argument("--model", default=os.getenv("OLLAMA_MODEL", "qwen3.6:27b"))
    parser.add_argument(
        "--base-url",
        default=os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434"),
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=int(os.getenv("AI_CLASSIFIER_TIMEOUT_SECONDS", "300")),
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--max-cases", type=int, default=0)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    suite = load_suite(args.cases)
    if args.max_cases > 0:
        suite = suite.model_copy(update={"cases": suite.cases[: args.max_cases]})
    report = run_benchmark(
        suite,
        model=args.model,
        base_url=args.base_url,
        timeout_seconds=args.timeout_seconds,
    )
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0 if report["metrics"]["passed"] else 1  # type: ignore[index]


if __name__ == "__main__":
    sys.exit(main())
