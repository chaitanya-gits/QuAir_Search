from __future__ import annotations

from datetime import UTC, datetime

import httpx

from backend.config import settings
from backend.crawler.extractor import extract_document
from backend.crawler.robots import can_fetch


async def crawl_url(url: str) -> dict | None:
    if not can_fetch(url, settings.crawl_user_agent):
        return None

    try:
        response_text = await _fetch_page(url)
    except httpx.HTTPError:
        return None

    if not response_text:
        return None

    document = extract_document(url, response_text)
    document["updated_at"] = datetime.now(UTC)
    return document


async def _fetch_page(url: str) -> str | None:
    timeout = httpx.Timeout(settings.crawl_timeout_seconds)
    limits = httpx.Limits(max_connections=4, max_keepalive_connections=2)

    async with httpx.AsyncClient(
        follow_redirects=True,
        limits=limits,
        timeout=timeout,
        headers={"User-Agent": settings.crawl_user_agent},
    ) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()

            content_type = response.headers.get("content-type", "").lower()
            if content_type and "html" not in content_type and "text" not in content_type:
                return None

            content_length = response.headers.get("content-length")
            if (
                content_length
                and content_length.isdigit()
                and int(content_length) > settings.crawl_max_response_bytes
            ):
                return None

            chunks: list[bytes] = []
            total_bytes = 0
            async for chunk in response.aiter_bytes():
                total_bytes += len(chunk)
                if total_bytes > settings.crawl_max_response_bytes:
                    return None
                chunks.append(chunk)

            return b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
