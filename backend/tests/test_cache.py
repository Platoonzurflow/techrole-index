from typing import Any

import pytest
from redis.exceptions import RedisError

from app.services.cache import RedisJsonCache


class MemoryCacheClient:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.expirations: dict[str, int] = {}

    def get(self, name: str) -> str | None:
        return self.values.get(name)

    def set(self, name: str, value: str, *, ex: int) -> bool:
        self.values[name] = value
        self.expirations[name] = ex
        return True


class BrokenCacheClient:
    def get(self, name: str) -> str | None:
        del name
        raise RedisError("unavailable")

    def set(self, name: str, value: str, *, ex: int) -> Any:
        del name, value, ex
        raise RedisError("unavailable")


def test_cache_hashes_private_parts_and_preserves_ttl() -> None:
    client = MemoryCacheClient()
    cache = RedisJsonCache(
        enabled=True,
        redis_url="redis://unused",
        ttl_seconds=120,
        client=client,
    )
    parts = {"tier": "public", "query": "private-user@example.com"}

    assert cache.set("catalog", parts, {"items": [1, 2]}) is True
    key = next(iter(client.values))

    assert "private-user@example.com" not in key
    assert key.startswith("techrole:index-cache:v1:catalog:")
    assert client.expirations[key] == 120
    assert cache.get("catalog", parts) == {"items": [1, 2]}


def test_cache_fails_open_and_rejects_dynamic_namespace() -> None:
    cache = RedisJsonCache(
        enabled=True,
        redis_url="redis://unused",
        ttl_seconds=120,
        client=BrokenCacheClient(),
    )

    assert cache.get("detail", {"slug": "python-developer"}) is None
    assert cache.set("detail", {"slug": "python-developer"}, {"id": 1}) is False
    with pytest.raises(ValueError):
        RedisJsonCache.cache_key("user@example.com", {"id": 1})
