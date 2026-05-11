from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass

from backend.config import settings
from backend.crawler.frontier import CrawlFrontier
from backend.indexer.es_client import DisabledSearchIndexClient, SearchIndexClient
<<<<<<< HEAD
from backend.storage.postgres import DisabledPostgresStorage, PostgresStorage
=======
from backend.storage.postgres import PostgresStorage
>>>>>>> 082393a (Remove nested repo and clean structure)
from backend.storage.redis import RedisStorage


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RuntimeServices:
    postgres: PostgresStorage
    redis: RedisStorage | None = None
    search_index: SearchIndexClient | DisabledSearchIndexClient | None = None


@asynccontextmanager
async def open_runtime_services(
    *,
    with_redis: bool = False,
    with_search_index: bool = False,
    ensure_index: bool = False,
):
    postgres = PostgresStorage(settings.database_url)
    try:
        await postgres.connect()
    except Exception as exc:  # pragma: no cover - startup fallback
        logger.warning("Postgres unavailable at startup; continuing in degraded mode: %s", exc)
        postgres = DisabledPostgresStorage(settings.database_url, exc)

    redis = RedisStorage(settings.redis_url) if with_redis else None
    search_index = None

    try:
        if with_search_index and settings.enable_search_index:
            search_index = SearchIndexClient(settings.es_url, settings.search_index_name)
            if ensure_index:
                await search_index.ensure_index()
        elif with_search_index:
            search_index = DisabledSearchIndexClient()

        yield RuntimeServices(
            postgres=postgres,
            redis=redis,
            search_index=search_index,
        )
    finally:
        if redis is not None:
            await redis.close()
        await postgres.disconnect()


def require_redis(services: RuntimeServices) -> RedisStorage:
    if services.redis is None:
        raise RuntimeError("Redis service has not been configured.")
    return services.redis


def require_search_index(services: RuntimeServices) -> SearchIndexClient | DisabledSearchIndexClient:
    if services.search_index is None:
        raise RuntimeError("Search index service has not been configured.")
    return services.search_index


def build_frontier(services: RuntimeServices) -> CrawlFrontier:
    return CrawlFrontier(require_redis(services))
