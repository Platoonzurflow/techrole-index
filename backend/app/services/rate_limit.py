from __future__ import annotations

import logging
from typing import Protocol

from redis import Redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger(__name__)


class RateLimitExceeded(RuntimeError):
    pass


class RateLimiterUnavailable(RuntimeError):
    pass


class AuthRateLimiter(Protocol):
    def check(self, ip_hash: str) -> None: ...


class SupportRateLimiter(Protocol):
    def check(self, ip_hash: str, email_hash: str) -> None: ...


class RedisRateLimiter:
    def __init__(self, redis_url: str) -> None:
        self.client = Redis.from_url(redis_url, decode_responses=True)

    def _increment(self, key: str, *, limit: int, window_seconds: int) -> None:
        pipeline = self.client.pipeline(transaction=True)
        pipeline.incr(key)
        pipeline.expire(key, window_seconds, nx=True)
        count, _ = pipeline.execute()
        if int(count) > limit:
            raise RateLimitExceeded


class RedisAuthRateLimiter(RedisRateLimiter):
    def check(self, ip_hash: str) -> None:
        try:
            self._increment(f"auth:ip:{ip_hash}", limit=10, window_seconds=600)
        except RateLimitExceeded:
            raise
        except RedisError as exc:
            if settings.app_env == "production":
                logger.error("auth_rate_limiter_unavailable")
                raise RateLimiterUnavailable from exc
            logger.warning("auth_rate_limiter_unavailable")


class RedisSupportRateLimiter(RedisRateLimiter):

    def check(self, ip_hash: str, email_hash: str) -> None:
        try:
            self._increment(f"support:ip:{ip_hash}", limit=5, window_seconds=3600)
            self._increment(f"support:email:{email_hash}", limit=10, window_seconds=86400)
        except RateLimitExceeded:
            raise
        except RedisError:
            # A support request should not be lost solely because the limiter is temporarily unavailable.
            logger.warning("support_rate_limiter_unavailable")


def get_auth_rate_limiter() -> AuthRateLimiter:
    return RedisAuthRateLimiter(settings.redis_url)


def get_support_rate_limiter() -> SupportRateLimiter:
    return RedisSupportRateLimiter(settings.redis_url)
