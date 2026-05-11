from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query, Request
from backend.search.engine import SearchFilters

router = APIRouter()

EMPTY_SEARCH_PAYLOAD = {
    "query": "",
    "search_queries": [],
    "sources": [],
    "final_answer": "insufficient data",
}

@router.get("/search")
async def search(
    request: Request,
    q: str = Query("", alias="q"),
    site: str = Query("", alias="site"),
    filetype: str = Query("", alias="filetype"),
    date_range: str = Query("", alias="date_range"),
    region: str = Query("", alias="region"),
    safe_search: str = Query("moderate", alias="safe_search"),
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
