from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple in-process cache (lives for one hour)
_trend_cache: list[dict] = []
_trend_cache_ts: float = 0.0
_CACHE_TTL = 3600  # seconds

# Curated fallback — shown when Google Trends is unreachable (e.g. inside Docker)
# These are genuinely popular global/Indian searches, NOT user history.
_FALLBACK_TRENDING: list[dict] = [
    {"title": "IPL 2025 live score",       "image": "", "description": "Trending"},
    {"title": "AI news today",             "image": "", "description": "Trending"},
    {"title": "ChatGPT latest update",     "image": "", "description": "Trending"},
    {"title": "India vs Pakistan cricket", "image": "", "description": "Trending"},
    {"title": "Stock market today",        "image": "", "description": "Trending"},
    {"title": "Gemini AI",                 "image": "", "description": "Trending"},
    {"title": "Weather forecast",          "image": "", "description": "Trending"},
    {"title": "Tesla stock price",         "image": "", "description": "Trending"},
    {"title": "Gold rate today",           "image": "", "description": "Trending"},
    {"title": "Champions League 2025",     "image": "", "description": "Trending"},
]


async def _fetch_google_trends(geo: str = "IN") -> list[dict]:
    """Fetch daily trending searches from Google Trends API."""
    url = (
        f"https://trends.google.com/trends/api/dailytrends"
        f"?hl=en-US&tz=-330&geo={geo}&ns=15"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
                    ),
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            resp.raise_for_status()
            # Response starts with ")]}'\n" — strip the XSSI guard
            raw = resp.text.lstrip(")]}'\n")
            data = json.loads(raw)
            stories = (
                data.get("default", {})
                .get("trendingSearchesDays", [{}])[0]
                .get("trendingSearches", [])
            )
            results: list[dict] = []
            for story in stories[:10]:
                title = story.get("title", {}).get("query", "")
                if not title:
                    continue
                image = ""
                articles = story.get("articles", [])
                if articles:
                    image = articles[0].get("image", {}).get("imageUrl", "")
                description = story.get("formattedTraffic", "Trending")
                results.append(
                    {"title": title, "image": image, "description": description}
                )
            return results
    except Exception:
        logger.warning("Google Trends fetch failed — using curated fallback")
        return []


@router.get("/trending")
async def trending(request: Request, geo: str = "IN") -> dict:
    global _trend_cache, _trend_cache_ts

    now = datetime.now(timezone.utc).timestamp()

    # Return cached data if still fresh
    if now - _trend_cache_ts < _CACHE_TTL and _trend_cache:
        rich = _trend_cache
    else:
        rich = await _fetch_google_trends(geo)
        if rich:
            _trend_cache = rich
            _trend_cache_ts = now

    # Use curated fallback — NEVER fall back to user's own Redis history
    if not rich:
        rich = _FALLBACK_TRENDING

    return {
        "topics": [item["title"] for item in rich],
        "rich": rich,
    }
