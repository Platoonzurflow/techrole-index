import hashlib
import json
import logging
import re
from collections.abc import Mapping
from typing import Any, Protocol, cast

from redis import Redis
from redis.exceptions import RedisError

from app.observability import record_cache_operation

logger = logging.getLogger(__name__)
namespace_pattern = re.compile(r"^[a-z_]{1,32}$")


class CacheClient(Protocol):
    def get(self, name: str) -> str | bytes | None: ...

    def set(self, name: str, value: str, *, ex: int) -> Any: ...


class RedisJsonCache:
    def __init__(
        self,
        *,
        enabled: bool,
        redis_url: str,
        ttl_seconds: int,
        client: CacheClient | None = None,
    ) -> None:
        self.enabled = enabled
        self.redis_url = redis_url
        self.ttl_seconds = ttl_seconds
        self._client = client

    @property
    def client(self) -> CacheClient:
        if self._client is None:
            self._client = cast(
                CacheClient,
                Redis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=0.25,
                    socket_timeout=0.25,
                    health_check_interval=30,
                ),
            )
        return self._client

    @staticmethod
    def cache_key(namespace: str, parts: Mapping[str, object]) -> str:
        if not namespace_pattern.fullmatch(namespace):
            raise ValueError("Cache namespace must be a bounded static identifier")
        canonical = json.dumps(parts, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return f"techrole:index-cache:v1:{namespace}:{digest}"

    def get(self, namespace: str, parts: Mapping[str, object]) -> object | None:
        if not self.enabled:
            return None
        try:
            raw = self.client.get(self.cache_key(namespace, parts))
            if raw is None:
                record_cache_operation(namespace=namespace, result="miss")
                return None
            payload = json.loads(raw)
        except (RedisError, OSError, ValueError, TypeError, json.JSONDecodeError):
            record_cache_operation(namespace=namespace, result="error")
            logger.warning("cache_read_failed", extra={"cache_namespace": namespace})
            return None
        record_cache_operation(namespace=namespace, result="hit")
        return payload

    def set(self, namespace: str, parts: Mapping[str, object], payload: object) -> bool:
        if not self.enabled:
            return False
        try:
            value = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
            self.client.set(
                self.cache_key(namespace, parts),
                value,
                ex=self.ttl_seconds,
            )
        except (RedisError, OSError, ValueError, TypeError):
            record_cache_operation(namespace=namespace, result="error")
            logger.warning("cache_write_failed", extra={"cache_namespace": namespace})
            return False
        return True
