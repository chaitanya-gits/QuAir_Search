from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from backend.config import settings
from backend.crawler.frontier import CrawlFrontier
from backend.crawler.spider import crawl_url
from backend.indexer.es_client import SearchIndexClient
from backend.indexer.pipeline import ingest_documents
from backend.storage.postgres import PostgresStorage


class CrawlScheduler:
    def __init__(
        self,
        frontier: CrawlFrontier,
        postgres: PostgresStorage,
        search_index: SearchIndexClient,
    ) -> None:
        self._frontier = frontier
        self._postgres = postgres
        self._search_index = search_index
        self._scheduler = AsyncIOScheduler()

    async def _run_once(self) -> None:
        url = await self._frontier.next_url()
        if not url:
            return
        document = await crawl_url(url)
        if document:
            await ingest_documents(self._postgres, self._search_index, [document])
            await self._frontier.seed(document.get("outbound_links", [])[:10])

    async def _refresh_views(self) -> None:
        try:
            async with self._postgres.pool.acquire() as connection:
                await connection.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_search_stats")
                await connection.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_queries")
                await connection.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_clicked_urls")
        except Exception:
            pass

    def start(self) -> None:
        self._scheduler.add_job(self._run_once, "interval", seconds=settings.crawl_interval_seconds, id="crawl-loop", replace_existing=True)
        self._scheduler.add_job(self._refresh_views, "interval", hours=1, id="mv-refresh", replace_existing=True)
        self._scheduler.start()

    def stop(self) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
