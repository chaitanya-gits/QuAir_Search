from __future__ import annotations

from fastapi import APIRouter
from backend.config import settings

router = APIRouter()


@router.get("/config")
async def get_public_config() -> dict:
    """Expose only public-safe flags to the frontend. Never return API keys or secrets."""
    return {
        "youtube_integration_enabled": bool(settings.youtube_api_key.strip()),
    }
