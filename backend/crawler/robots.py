from __future__ import annotations

from functools import lru_cache
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser


@lru_cache(maxsize=256)
def _load_parser(robots_url: str) -> RobotFileParser:
    parser = RobotFileParser()
    parser.set_url(robots_url)

    try:
        parser.read()
    except Exception:
        return parser

    return parser


def _build_robots_url(url: str) -> str:
    parsed_url = urlparse(url)
    return urljoin(f"{parsed_url.scheme}://{parsed_url.netloc}", "/robots.txt")


def can_fetch(url: str, user_agent: str) -> bool:
    parser = _load_parser(_build_robots_url(url))
    return parser.can_fetch(user_agent, url)
