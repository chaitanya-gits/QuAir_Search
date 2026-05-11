from __future__ import annotations

from fastapi import APIRouter, Query, Request

from backend.config import settings


router = APIRouter()


UNSAFE_SUGGESTIONS = [
    "nude", "nude photos", "violence gore films", "adult flm list",
    "breast cancer images", "breast cancer", "graphic violence",
    "porn", "xxx", "naked", "sex", "hentai", "nsfw",
    "gore", "beheading", "execution", "murder", "torture"
]

def is_safe_suggestion(text: str) -> bool:
    text_lower = text.lower()
    return not any(unsafe in text_lower for unsafe in UNSAFE_SUGGESTIONS)


@router.get("/suggest")
async def suggest(request: Request, q: str = Query("", alias="q")) -> dict:
    query = q.strip()
    raw_suggestions = await request.app.state.redis.get_suggestions(
        query,
        settings.suggestion_limit * 2,  # Fetch extra in case of filtering
    )
    raw_trending = await request.app.state.redis.get_trending_queries(
        settings.suggestion_limit * 2,
    )
    
    suggestions = [s for s in raw_suggestions if is_safe_suggestion(s)][:settings.suggestion_limit]
    trending = [t for t in raw_trending if is_safe_suggestion(t)][:settings.suggestion_limit]
    
    return {
        "query": query,
        "suggestions": suggestions,
        "trending": trending,
    }
