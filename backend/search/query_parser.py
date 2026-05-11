from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import get_close_matches


STOPWORDS = {
    "a",
    "an",
    "and",
    "for",
    "from",
    "how",
    "i",
    "in",
    "me",
    "of",
    "on",
    "please",
    "search",
    "show",
    "tell",
    "the",
    "to",
    "what",
}


@dataclass(slots=True)
class ParsedQuery:
    raw: str
    normalized: str
    tokens: list[str]
    search_queries: list[str]


def _normalize_token(token: str) -> str:
    return re.sub(r"[^a-z0-9.-]+", "", token.lower())


def parse_query(raw_query: str, vocabulary: set[str] | None = None) -> ParsedQuery:
    normalized = re.sub(r"\s+", " ", raw_query).strip()
    tokens = [_normalize_token(token) for token in normalized.split()]
    filtered = [token for token in tokens if token and token not in STOPWORDS]

    corrected: list[str] = []
    lexicon = sorted(vocabulary or set())
    for token in filtered:
        if token in lexicon or not lexicon:
            corrected.append(token)
            continue
        match = get_close_matches(token, lexicon, n=1, cutoff=0.88)
        corrected.append(match[0] if match else token)

    search_queries: list[str] = []
    if normalized:
        search_queries.append(normalized)
    if corrected:
        corrected_query = " ".join(corrected)
        if corrected_query not in search_queries:
            search_queries.append(corrected_query)

    return ParsedQuery(raw=raw_query, normalized=normalized, tokens=corrected, search_queries=search_queries or [""])
