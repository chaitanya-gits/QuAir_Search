from __future__ import annotations

from fastapi import APIRouter, Request


router = APIRouter()


@router.get("/health")
async def healthcheck(request: Request) -> dict:
    postgres = request.app.state.postgres
    redis = request.app.state.redis
    search_index = request.app.state.search_index

    services = {
        "postgres": await postgres.healthcheck(),
        "redis": await redis.healthcheck(),
        "opensearch": await search_index.healthcheck(),
    }
    overall_status = "ok" if all(services.values()) else "degraded"

    return {
        "status": overall_status,
        "services": services,
    }
