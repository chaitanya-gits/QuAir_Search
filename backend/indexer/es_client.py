from __future__ import annotations

import asyncio
from typing import Any

from opensearchpy import OpenSearch
from opensearchpy.helpers import bulk

from backend.indexer.schema import search_index_mapping


SEARCH_FIELDS = ["title^3", "summary^2", "body"]


class DisabledSearchIndexClient:
    index_name = "disabled"

    async def ensure_index(self) -> None:
        return None

    async def healthcheck(self) -> bool:
        return True

    async def upsert_documents(self, documents: list[dict[str, Any]]) -> None:
        return None

    async def text_search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        return []


class SearchIndexClient:
    def __init__(self, base_url: str, index_name: str) -> None:
        self._client = OpenSearch(
            hosts=[base_url],
            use_ssl=False,
            verify_certs=False,
            ssl_assert_hostname=False,
            ssl_show_warn=False,
        )
        self.index_name = index_name

    async def ensure_index(self) -> None:
        if not self._client.indices.exists(index=self.index_name):
            self._client.indices.create(
                index=self.index_name,
                body=search_index_mapping(),
            )

    async def healthcheck(self) -> bool:
        try:
            await asyncio.to_thread(self._client.cluster.health)
            return True
        except Exception:
            return False

    async def upsert_documents(self, documents: list[dict[str, Any]]) -> None:
        if not documents:
            return

        await self.ensure_index()
        actions = [self._build_index_action(document) for document in documents]
        bulk(self._client, actions)
        self._client.indices.refresh(index=self.index_name)

    async def text_search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """Run a non-blocking OpenSearch query via ``asyncio.to_thread``."""

        def _run() -> dict[str, Any]:
            if not self._client.indices.exists(index=self.index_name):
                self._client.indices.create(
                    index=self.index_name,
                    body=search_index_mapping(),
                )
            return self._client.search(
                index=self.index_name,
                body={
                    "size": limit,
                    "query": {
                        "multi_match": {
                            "query": query,
                            "fields": SEARCH_FIELDS,
                            "type": "best_fields",
                        }
                    },
                },
            )

        try:
            response = await asyncio.to_thread(_run)
        except Exception:
            return []

        hits = response.get("hits", {}).get("hits", [])
        return [self._serialize_hit(hit) for hit in hits]

    def _build_index_action(self, document: dict[str, Any]) -> dict[str, Any]:
        return {
            "_op_type": "index",
            "_index": self.index_name,
            "_id": document["url"],
            **document,
        }

    @staticmethod
    def _serialize_hit(hit: dict[str, Any]) -> dict[str, Any]:
        source = hit.get("_source", {})
        return {
            "url": source.get("url", ""),
            "title": source.get("title", ""),
            "body": source.get("body", ""),
            "summary": source.get("summary", ""),
            "updated_at": source.get("updated_at"),
            "score": float(hit.get("_score", 0.0)),
        }
