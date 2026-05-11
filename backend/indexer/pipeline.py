from __future__ import annotations

from typing import Any

from backend.indexer.es_client import DisabledSearchIndexClient, SearchIndexClient
from backend.storage.postgres import PostgresStorage


async def ingest_documents(
    postgres: PostgresStorage,
    search_index: SearchIndexClient | DisabledSearchIndexClient,
    documents: list[dict[str, Any]],
) -> None:
    indexed_documents: list[dict[str, Any]] = []

    for document in documents:
        await postgres.upsert_page(
            url=document["url"],
            title=document["title"],
            body=document["body"],
            summary=document["summary"],
            outbound_links=document.get("outbound_links", []),
            last_seed_query=document.get("last_seed_query", ""),
        )
        indexed_documents.append(_build_index_document(document))

    await search_index.upsert_documents(indexed_documents)


def _build_index_document(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "url": document["url"],
        "title": document["title"],
        "body": document["body"],
        "summary": document["summary"],
        "updated_at": document["updated_at"],
    }
