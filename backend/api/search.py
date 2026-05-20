from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query, Request
from backend.search.engine import SearchFilters

router = APIRouter()

MAX_QUERY_LENGTH = 512
MAX_FILTER_LENGTH = 128

EMPTY_SEARCH_PAYLOAD = {
    "query": "",
    "search_queries": [],
    "sources": [],
    "final_answer": "insufficient data",
}

@router.get("/search")
async def search(
    request: Request,
    q: str = Query(..., alias="q", min_length=1, max_length=MAX_QUERY_LENGTH),
    site: str = Query("", alias="site", max_length=MAX_FILTER_LENGTH),
    filetype: str = Query("", alias="filetype", max_length=32),
    date_range: str = Query("", alias="date_range", max_length=64),
    region: str = Query("", alias="region", max_length=16),
    safe_search: str = Query("strict", alias="safe_search", max_length=16),
) -> dict:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail=EMPTY_SEARCH_PAYLOAD)

    return await request.app.state.search_engine.search(
        query,
        filters=SearchFilters(
            site=site.strip(),
            filetype=filetype.strip(),
            date_range=date_range.strip(),
            region=region.strip().upper(),
            safe_search=safe_search.strip().lower(),
        ),
    )

@router.get("/index/status")
async def index_status(request: Request) -> dict:
    postgres = request.app.state.postgres
    redis = request.app.state.redis
    search_index = request.app.state.search_index

    return {
        "postgres_documents": await postgres.count_pages(),
        "redis_connected": await redis.healthcheck(),
        "opensearch_connected": await search_index.healthcheck(),
    }
