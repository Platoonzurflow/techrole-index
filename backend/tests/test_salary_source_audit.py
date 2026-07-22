from __future__ import annotations

import httpx

from app.data.salary_benchmarks import HABR_CALCULATOR_MEDIANS
from app.services.salary_source_audit import audit_habr_calculator_public_medians


def _expected_by_alias() -> dict[str, tuple[str, int]]:
    return {
        alias: (label, median)
        for alias, label, median in HABR_CALCULATOR_MEDIANS.values()
    }


def _public_page(label: str, median: int) -> str:
    return (
        "<html><head>"
        f"<title>Сколько зарабатывает {label}? – Хабр Карьера</title>"
        f'<meta name="description" content="{label} зарабатывает {median} руб. '
        'Все зарплаты по IT-специализациям на Хабр Карьере.">'
        '</head><body data-account-median="999999">not inspected</body></html>'
    )


def test_salary_source_audit_verifies_only_public_metadata() -> None:
    expected = _expected_by_alias()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "career.habr.com"
        assert request.url.params["qualification"] == "All"
        alias = request.url.params.get_list("spec_aliases[]")[0]
        label, median = expected[alias]
        return httpx.Response(200, text=_public_page(label, median))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = audit_habr_calculator_public_medians(client=client)

    assert result["status"] == "verified"
    assert result["checked"] == len(expected)
    assert result["verified"] == len(expected)
    assert result["changed"] == 0
    assert result["unavailable"] == 0


def test_salary_source_audit_reports_public_metadata_drift() -> None:
    expected = _expected_by_alias()

    def handler(request: httpx.Request) -> httpx.Response:
        alias = request.url.params.get_list("spec_aliases[]")[0]
        label, median = expected[alias]
        if alias == "data_scientist":
            median += 1
        return httpx.Response(200, text=_public_page(label, median))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = audit_habr_calculator_public_medians(client=client)

    changed = [entry for entry in result["entries"] if entry["status"] == "changed"]
    assert result["status"] == "changed"
    assert result["changed"] == 1
    assert changed[0]["slug"] == "data-scientist"
    assert changed[0]["expected_median"] == 235541
    assert changed[0]["observed_median"] == 235542


def test_salary_source_audit_keeps_transient_unavailability_separate() -> None:
    expected = _expected_by_alias()
    manual_attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal manual_attempts
        alias = request.url.params.get_list("spec_aliases[]")[0]
        if alias == "manual_testing":
            manual_attempts += 1
            return httpx.Response(503)
        label, median = expected[alias]
        return httpx.Response(200, text=_public_page(label, median))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = audit_habr_calculator_public_medians(client=client)

    unavailable = [
        entry for entry in result["entries"] if entry["status"] == "unavailable"
    ]
    assert result["status"] == "partial"
    assert result["changed"] == 0
    assert result["unavailable"] == 1
    assert manual_attempts == 3
    assert unavailable[0]["slug"] == "qa-manual"
    assert unavailable[0]["error"] == "HTTPStatusError"
