from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import app
from app.observability import route_template


def test_health_response_has_security_and_generated_request_id() -> None:
    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert len(response.headers["x-request-id"]) == 32
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_valid_request_id_is_preserved_and_invalid_value_is_replaced() -> None:
    with TestClient(app) as client:
        preserved = client.get("/health/live", headers={"X-Request-ID": "trace-12345678"})
        replaced = client.get("/health/live", headers={"X-Request-ID": "bad value"})

    assert preserved.headers["x-request-id"] == "trace-12345678"
    assert replaced.headers["x-request-id"] != "bad value"
    assert len(replaced.headers["x-request-id"]) == 32


def test_metrics_use_bounded_route_labels_and_do_not_leak_path_values() -> None:
    private_path = "/private-user@example.com"
    with TestClient(app) as client:
        assert client.get(private_path).status_code == 404
        response = client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain; version=0.0.4")
    assert "techrole_http_requests_total" in response.text
    assert 'route="unmatched"' in response.text
    assert "private-user@example.com" not in response.text
    assert "x-request-id" not in response.text.lower()


def test_route_template_restores_api_prefix_without_dynamic_slug() -> None:
    route = type("Route", (), {"path": "/professions/{slug}"})()
    request = Request({
        "type": "http",
        "method": "GET",
        "path": "/api/v1/professions/private-user@example.com",
        "headers": [],
        "route": route,
    })

    label = route_template(request)

    assert label == "/api/v1/professions/{slug}"
    assert "private-user@example.com" not in label
