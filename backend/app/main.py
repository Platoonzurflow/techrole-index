import logging
import re
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger.json import JsonFormatter

from app.api import (
    admin,
    analytics,
    auth,
    mentorship,
    open_data,
    payments,
    premium,
    professions,
    status,
    support,
)
from app.config import settings
from app.observability import record_http_request, render_metrics, route_template

logger = logging.getLogger(__name__)
request_id_pattern = re.compile(r"^[A-Za-z0-9-]{8,64}$")


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    del app
    configure_logging()
    logging.getLogger(__name__).info("application_started", extra={"app_env": settings.app_env})
    yield


app = FastAPI(
    title="TechRole Index API",
    version="0.1.0",
    description="Аналитика рынка IT-профессий, зарплат и спроса с Premium-возможностями.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=[
        "Content-Type",
        "Idempotency-Key",
        "X-CSRF-Token",
        "X-Demo-Signature",
    ],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    incoming_request_id = request.headers.get("X-Request-ID", "")
    request_id = (
        incoming_request_id if request_id_pattern.fullmatch(incoming_request_id) else uuid4().hex
    )
    request.state.request_id = request_id
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_seconds = time.perf_counter() - started_at
        route = route_template(request)
        record_http_request(
            method=request.method,
            route=route,
            status_code=500,
            duration_seconds=duration_seconds,
        )
        logger.exception(
            "http_request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": route,
                "duration_ms": round(duration_seconds * 1000, 2),
            },
        )
        raise
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    duration_seconds = time.perf_counter() - started_at
    route = route_template(request)
    record_http_request(
        method=request.method,
        route=route,
        status_code=response.status_code,
        duration_seconds=duration_seconds,
    )
    if request.url.path not in {"/health/live", "/api/v1/health/ready"}:
        logger.info(
            "http_request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": route,
                "status_code": response.status_code,
                "duration_ms": round(duration_seconds * 1000, 2),
            },
        )
    return response


@app.get("/health/live", tags=["service"])
def live():
    return {"status": "alive"}


@app.get("/metrics", tags=["service"], include_in_schema=False)
def metrics():
    return Response(
        content=render_metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


for api_router in (
    professions.router,
    open_data.router,
    auth.router,
    payments.router,
    premium.router,
    admin.router,
    status.router,
    support.router,
    mentorship.router,
    analytics.router,
    analytics.admin_router,
):
    app.include_router(api_router, prefix="/api/v1")
