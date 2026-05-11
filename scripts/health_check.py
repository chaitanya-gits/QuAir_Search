from __future__ import annotations

import asyncio

from backend.runtime import open_runtime_services, require_redis, require_search_index


async def main() -> None:
    async with open_runtime_services(with_redis=True, with_search_index=True) as services:
        redis = require_redis(services)
        search_index = require_search_index(services)
        health = {
            "postgres": await services.postgres.healthcheck(),
            "redis": await redis.healthcheck(),
            "opensearch": await search_index.healthcheck(),
        }
        print(health)


if __name__ == "__main__":
    asyncio.run(main())
