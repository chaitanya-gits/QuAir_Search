from __future__ import annotations

import asyncio

from backend.config import settings
from backend.crawler.spider import crawl_url
from backend.indexer.pipeline import ingest_documents
from backend.runtime import build_frontier, open_runtime_services, require_search_index


async def main() -> None:
    while True:
        try:
            async with open_runtime_services(
                with_redis=True,
                with_search_index=True,
                ensure_index=True,
            ) as services:
                frontier = build_frontier(services)
                search_index = require_search_index(services)

                while True:
                    try:
                        url = await frontier.next_url()
                        if not url:
                            await asyncio.sleep(settings.worker_idle_sleep_seconds)
                            continue

                        document = await crawl_url(url)
                        if document is None:
                            continue

                        await ingest_documents(services.postgres, search_index, [document])
                    except Exception:
                        await asyncio.sleep(settings.worker_error_sleep_seconds)
        except Exception:
            await asyncio.sleep(settings.worker_error_sleep_seconds)


if __name__ == "__main__":
    asyncio.run(main())
