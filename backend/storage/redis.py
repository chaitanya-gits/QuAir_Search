from __future__ import annotations

import logging
from collections.abc import Iterable

from redis.asyncio import Redis


TRENDING_KEY = "search:trending"
FRONTIER_KEY = "crawl:frontier"
BLOCKED_TRENDING_QUERIES = {
    "dc current",
    "how to make chicken biryani",
    "world war 2",
    "reciprocal rank fusion",
    "access key secret access key akiav4nzkrnaravzpxhh t6h7pjmnbcqmcybeoq1iq1g0upexa3alapvy8lzt",
    "what common mistakes should someone avoid when learning about world war 2?",
    "untitled.png",
}
<<<<<<< HEAD


logger = logging.getLogger(__name__)
=======
>>>>>>> 082393a (Remove nested repo and clean structure)


class RedisStorage:
    def __init__(self, redis_url: str) -> None:
        self._redis = Redis.from_url(redis_url, decode_responses=True)

    @property
    def client(self) -> Redis:
        return self._redis

    async def close(self) -> None:
        await self._redis.aclose()

    async def healthcheck(self) -> bool:
        try:
            await self._redis.ping()
            return True
        except Exception:
            return False

    async def record_query(self, query: str) -> None:
        normalized_query = _normalize_trending_query(query)
        if normalized_query:
            try:
                await self._redis.zincrby(TRENDING_KEY, 1, normalized_query)
            except Exception:  # pragma: no cover - defensive
                logger.exception("failed to record trending query")

    async def get_trending_queries(self, limit: int) -> list[str]:
        end_index = max(limit - 1, 0)
<<<<<<< HEAD
        try:
            items = await self._redis.zrevrange(TRENDING_KEY, 0, end_index)
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to fetch trending queries")
            return []
=======
        items = await self._redis.zrevrange(TRENDING_KEY, 0, end_index)
>>>>>>> 082393a (Remove nested repo and clean structure)
        return [item for item in items if _normalize_trending_query(item)]

    async def get_suggestions(self, prefix: str, limit: int) -> list[str]:
        normalized_prefix = prefix.strip().lower()
        candidates = await self.get_trending_queries(limit * 4)

        if not normalized_prefix:
            return candidates[:limit]

        matches = [item for item in candidates if item.startswith(normalized_prefix)]
        return matches[:limit]

    async def push_frontier(self, urls: Iterable[str]) -> None:
        cleaned_urls = [url.strip() for url in urls if url and url.strip()]
        if cleaned_urls:
            try:
                await self._redis.rpush(FRONTIER_KEY, *cleaned_urls)
            except Exception:  # pragma: no cover - defensive
                logger.exception("failed to push crawl frontier")

    async def pop_frontier(self) -> str | None:
<<<<<<< HEAD
        try:
            return await self._redis.lpop(FRONTIER_KEY)
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to pop crawl frontier")
            return None
=======
        return await self._redis.lpop(FRONTIER_KEY)
>>>>>>> 082393a (Remove nested repo and clean structure)


def _normalize_trending_query(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized:
        return ""
    if normalized in BLOCKED_TRENDING_QUERIES:
        return ""
    if _looks_like_secret(normalized):
        return ""
    if normalized.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg")):
        return ""
    return normalized


def _looks_like_secret(value: str) -> bool:
    if "secret access key" in value:
        return True
    if "access key" in value and "akia" in value:
        return True
    return False
