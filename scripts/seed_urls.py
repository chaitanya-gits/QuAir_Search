from __future__ import annotations

import asyncio
import sys

from backend.runtime import open_runtime_services, require_redis


async def main(urls: list[str]) -> None:
    cleaned_urls = [url.strip() for url in urls if url.strip()]
    if not cleaned_urls:
        return

    async with open_runtime_services(with_redis=True) as services:
        redis = require_redis(services)
        await redis.push_frontier(cleaned_urls)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
