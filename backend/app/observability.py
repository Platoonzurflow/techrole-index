import os

from fastapi import Request
from prometheus_client import (
    REGISTRY,
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
)
from prometheus_client.multiprocess import MultiProcessCollector

HTTP_REQUESTS = Counter(
    "techrole_http_requests_total",
    "Completed HTTP requests without user or query identifiers.",
    ("method", "route", "status_class"),
)
HTTP_DURATION = Histogram(
    "techrole_http_request_duration_seconds",
    "HTTP request duration grouped only by method and route template.",
    ("method", "route"),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
CACHE_OPERATIONS = Counter(
    "techrole_cache_operations_total",
    "Redis cache outcomes with bounded namespace and result labels.",
    ("namespace", "result"),
)


def safe_method(method: str) -> str:
    normalized = method.upper()
    return normalized if normalized in {"GET", "POST", "PATCH", "DELETE", "PUT", "HEAD", "OPTIONS"} else "OTHER"


def route_template(request: Request) -> str:
    route = request.scope.get("route")
    template = getattr(route, "path", None)
    raw_path = request.scope.get("path")
    if not isinstance(template, str) or not template.startswith("/"):
        return "unmatched"
    if not isinstance(raw_path, str) or not raw_path.startswith("/"):
        return template
    template_parts = [part for part in template.split("/") if part]
    raw_parts = [part for part in raw_path.split("/") if part]
    if len(raw_parts) < len(template_parts):
        return template
    prefix_parts = raw_parts[: len(raw_parts) - len(template_parts)]
    return "/" + "/".join([*prefix_parts, *template_parts])


def record_http_request(*, method: str, route: str, status_code: int, duration_seconds: float) -> None:
    labels = {"method": safe_method(method), "route": route, "status_class": f"{status_code // 100}xx"}
    HTTP_REQUESTS.labels(**labels).inc()
    HTTP_DURATION.labels(method=labels["method"], route=route).observe(duration_seconds)


def record_cache_operation(*, namespace: str, result: str) -> None:
    CACHE_OPERATIONS.labels(namespace=namespace, result=result).inc()


def render_metrics() -> bytes:
    if os.getenv("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        MultiProcessCollector(registry)
        return generate_latest(registry)
    return generate_latest(REGISTRY)
