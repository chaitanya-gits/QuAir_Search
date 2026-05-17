"""Background worker that recomputes PageRank scores every 10 minutes.

Reads all nodes and edges from Postgres, runs the iterative PageRank
algorithm, then writes the scores back into the ``pages.pagerank_score``
column so the search engine can read them directly without recomputing.
"""
from __future__ import annotations

import asyncio
import logging

from backend.ranking.pagerank import compute_pagerank_scores
from backend.runtime import open_runtime_services

logger = logging.getLogger(__name__)

REFRESH_INTERVAL_SECONDS = 600  # 10 minutes


async def _run_once(postgres) -> int:
    """Compute PageRank and persist scores. Returns the number of nodes scored."""
    node_rows = await postgres.pool.fetch("SELECT url FROM pages")
    link_rows = await postgres.pool.fetch(
        "SELECT source_url, target_url FROM page_links"
    )

    nodes = [str(row["url"]) for row in node_rows]
    edges = [
        (str(row["source_url"]), str(row["target_url"])) for row in link_rows
    ]

    if not nodes:
        logger.info("No pages in the database — skipping PageRank computation.")
        return 0

    scores = compute_pagerank_scores(edges, nodes=nodes)
    await postgres.update_pagerank_scores(scores)
    return len(scores)


async def main() -> None:
    async with open_runtime_services() as services:
        postgres = services.postgres

        if not postgres.is_available:
            logger.error("Postgres is unavailable — pagerank worker cannot start.")
            return

        logger.info("PageRank worker started (interval=%ds)", REFRESH_INTERVAL_SECONDS)

        while True:
            try:
                count = await _run_once(postgres)
                logger.info("PageRank scores updated for %d nodes.", count)
            except Exception:
                logger.exception("PageRank computation failed — will retry next cycle.")

            await asyncio.sleep(REFRESH_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )
    asyncio.run(main())
