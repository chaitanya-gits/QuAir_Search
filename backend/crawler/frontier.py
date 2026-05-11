from __future__ import annotations

from collections.abc import Iterable

from backend.storage.redis import RedisStorage


class CrawlFrontier:
    def __init__(self, redis: RedisStorage) -> None:
        self._redis = redis

    async def seed(self, urls: Iterable[str]) -> None:
        await self._redis.push_frontier(urls)

    async def next_url(self) -> str | None:
        return await self._redis.pop_frontier()
