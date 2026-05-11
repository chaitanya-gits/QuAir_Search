from __future__ import annotations

import asyncio

from backend.runtime import open_runtime_services, require_search_index


async def main() -> None:
    async with open_runtime_services(with_search_index=True, ensure_index=True) as services:
        search_index = require_search_index(services)
        documents = await services.postgres.fetch_page_documents(limit=1000)
        await search_index.upsert_documents(documents)


if __name__ == "__main__":
    asyncio.run(main())
