from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest
from fastapi import HTTPException
from redis.exceptions import RedisError
from starlette.requests import Request

from app.api.auth import _check_rate_limit
from app.config import settings
from app.services.rate_limit import (
    RateLimiterUnavailable,
    RateLimitExceeded,
    RedisAuthRateLimiter,
)


def request_from(host: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": (host, 1234),
        }
    )


@dataclass
class RecordingLimiter:
    calls: list[str] = field(default_factory=list)
    error: Exception | None = None

    def check(self, ip_hash: str) -> None:
        self.calls.append(ip_hash)
        if self.error:
            raise self.error


def test_auth_identifier_is_hashed_before_rate_limiting() -> None:
    limiter = RecordingLimiter()
    _check_rate_limit(request_from("203.0.113.10"), limiter)

    assert len(limiter.calls) == 1
    assert len(limiter.calls[0]) == 64
    assert "203.0.113.10" not in limiter.calls[0]


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [(RateLimitExceeded(), 429), (RateLimiterUnavailable(), 503)],
)
def test_auth_rate_limit_errors_have_safe_http_statuses(
    error: Exception, expected_status: int
) -> None:
    limiter = RecordingLimiter(error=error)

    with pytest.raises(HTTPException) as exc_info:
        _check_rate_limit(request_from("203.0.113.11"), limiter)

    assert exc_info.value.status_code == expected_status


class FakePipeline:
    def __init__(self, counts: dict[str, int]) -> None:
        self.counts = counts
        self.key = ""

    def incr(self, key: str) -> FakePipeline:
        self.key = key
        return self

    def expire(self, key: str, window_seconds: int, *, nx: bool) -> FakePipeline:
        assert key == self.key
        assert window_seconds == 600
        assert nx is True
        return self

    def execute(self) -> list[Any]:
        self.counts[self.key] = self.counts.get(self.key, 0) + 1
        return [self.counts[self.key], True]


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    def pipeline(self, *, transaction: bool) -> FakePipeline:
        assert transaction is True
        return FakePipeline(self.counts)


class OfflineRedis:
    def pipeline(self, *, transaction: bool) -> Any:
        raise RedisError("offline")


def test_redis_auth_limiter_shares_ten_attempt_window() -> None:
    limiter = RedisAuthRateLimiter("redis://unused")
    limiter.client = FakeRedis()  # type: ignore[assignment]

    for _ in range(10):
        limiter.check("a" * 64)
    with pytest.raises(RateLimitExceeded):
        limiter.check("a" * 64)


def test_redis_auth_limiter_fails_closed_in_production() -> None:
    limiter = RedisAuthRateLimiter("redis://unused")
    limiter.client = OfflineRedis()  # type: ignore[assignment]
    original_env = settings.app_env
    settings.app_env = "production"
    try:
        with pytest.raises(RateLimiterUnavailable):
            limiter.check("b" * 64)
    finally:
        settings.app_env = original_env
