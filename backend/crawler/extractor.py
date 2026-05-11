from __future__ import annotations

from bs4 import BeautifulSoup


TEXT_BLOCK_SELECTORS = ("nav", "footer", "script", "style", "header", "aside")
MAX_TITLE_LENGTH = 300
MAX_BODY_LENGTH = 20_000
MAX_SUMMARY_LENGTH = 280
MAX_OUTBOUND_LINKS = 100


def extract_document(url: str, html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    _remove_layout_noise(soup)

    title = _extract_title(soup, fallback=url)
    body = " ".join(soup.get_text(" ", strip=True).split())
    outbound_links = _extract_outbound_links(soup)

    return {
        "url": url,
        "title": title[:MAX_TITLE_LENGTH],
        "body": body[:MAX_BODY_LENGTH],
        "summary": (body[:MAX_SUMMARY_LENGTH] if body else title),
        "outbound_links": outbound_links[:MAX_OUTBOUND_LINKS],
    }


def _remove_layout_noise(soup: BeautifulSoup) -> None:
    for selector in TEXT_BLOCK_SELECTORS:
        for node in soup.select(selector):
            node.decompose()


def _extract_title(soup: BeautifulSoup, fallback: str) -> str:
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    return fallback.strip()


def _extract_outbound_links(soup: BeautifulSoup) -> list[str]:
    links: list[str] = []

    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "").strip()
        if href.startswith("http") and href not in links:
            links.append(href)

    return links
