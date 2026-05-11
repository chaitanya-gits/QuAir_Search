from __future__ import annotations

import asyncio

from backend.runtime import open_runtime_services


async def main() -> None:
    async with open_runtime_services() as services:
        documents = await services.postgres.fetch_page_documents(limit=100)
        urls = [document["url"] for document in documents]
        scores = await services.postgres.get_pagerank_scores(urls)

        for url, score in scores.items():
            print(f"{url}\t{score}")


if __name__ == "__main__":
    asyncio.run(main())
