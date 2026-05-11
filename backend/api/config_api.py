from __future__ import annotations

from fastapi import APIRouter
from backend.config import settings

router = APIRouter()


@router.get("/config")
async def get_public_config() -> dict:
    """Expose only public-safe config values to the frontend."""
    return {
        "youtube_api_key": settings.youtube_api_key,
    }
