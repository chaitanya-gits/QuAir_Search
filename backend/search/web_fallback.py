from __future__ import annotations

from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from backend.config import settings


async def search_public_web(query: str, *, limit: int = 8, region: str = "", safe_search: str = "moderate") -> list[dict]:
    tavily_results = await _search_tavily(query, limit=limit, region=region)
    if tavily_results:
        return tavily_results
    return await _search_duckduckgo(query, limit=limit, region=region, safe_search=safe_search)


async def _search_tavily(query: str, *, limit: int, region: str = "") -> list[dict]:
    api_key = settings.tavily_api_key.strip()
    if not api_key:
        return []

    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "max_results": limit,
        "include_answer": False,
        "include_images": True,
    }

    # Add region-specific domain bias via include_domains
    if region:
        from backend.search.engine import REGION_DOMAINS
        region_tlds = REGION_DOMAINS.get(region.upper(), [])
        if region_tlds:
            # Convert TLDs to domain patterns for Tavily
            include_domains = [tld.lstrip(".") for tld in region_tlds]
            payload["include_domains"] = include_domains
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(settings.tavily_api_url, json=payload)
            response.raise_for_status()
    except httpx.HTTPError:
        return []

    body = response.json()
    results = body.get("results", [])
    images: list[str] = [str(img) for img in body.get("images", []) if img]
    serialized: list[dict] = []
    for i, item in enumerate(results[:limit]):
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        content = str(item.get("content", "")).strip()
        serialized.append(
            {
                "url": url,
                "title": str(item.get("title", "")).strip() or url,
                "summary": content[:320] if content else "Web fallback result",
                "body": content,
                "score": 1.0,
                "source": "web",
                "sources": ["web"],
                "image": images[i] if i < len(images) else "",
                "published_date": str(item.get("published_date", "")).strip(),
            }
        )
    return serialized



async def _search_duckduckgo(query: str, *, limit: int, region: str = "", safe_search: str = "moderate") -> list[dict]:
    # Map region codes to DuckDuckGo region parameter
    ddg_regions = {
        "IN": "in-en", "US": "us-en", "GB": "uk-en", "CA": "ca-en",
        "AU": "au-en", "DE": "de-de", "FR": "fr-fr", "IT": "it-it",
        "ES": "es-es", "NL": "nl-nl", "BR": "br-pt", "MX": "mx-es",
        "JP": "jp-jp", "KR": "kr-kr", "RU": "ru-ru", "TR": "tr-tr",
    }
    region_param = ""
    if region:
        ddg_region = ddg_regions.get(region.upper(), "")
        if ddg_region:
            region_param = f"&kl={ddg_region}"
    # DDG safe search: kp=-1 (off), kp=1 (moderate/strict)
    safe_param = "&kp=-1" if safe_search == "off" else "&kp=1"
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}{region_param}{safe_param}"
    try:
        async with httpx.AsyncClient(
            timeout=settings.request_timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": settings.crawl_user_agent},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    serialized: list[dict] = []
    for result in soup.select(".result")[:limit]:
        link = result.select_one(".result__title a")
        snippet = result.select_one(".result__snippet")
        if link is None:
            continue
        href = str(link.get("href", "")).strip()
        if "uddg=" in href:
            from urllib.parse import unquote
            href = unquote(href.split("uddg=")[1].split("&")[0])

        title = link.get_text(" ", strip=True)
        summary = snippet.get_text(" ", strip=True) if snippet else "Web fallback result"
        if not href:
            continue
        
        # Give official websites a massive boost to ensure they're #1
        score = 1.0
        domain_match = title.lower().replace(" ", "") in href.lower() or href.lower().replace("www.", "").startswith(f"https://{query.lower().replace(' ', '')}")
        if domain_match:
            score = 10.0
        elif "wikipedia.org" in href:
            score = 8.0
            
        serialized.append(
            {
                "url": href,
                "title": title or href,
                "summary": summary[:320],
                "body": summary,
                "score": score,
                "source": "web",
                "sources": ["web"],
            }
        )
    return serialized

