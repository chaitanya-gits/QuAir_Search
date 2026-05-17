from __future__ import annotations

import logging
import math
import re
from collections import Counter
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ── Sentence-Transformers lazy init ──────────────────────────────────────────
_SBERT_MODEL: Any = None
_SBERT_AVAILABLE: bool | None = None  # None = not yet checked


def _get_sbert_model() -> Any:
    """Load the SentenceTransformer model on first call and cache it."""
    global _SBERT_MODEL, _SBERT_AVAILABLE

    if _SBERT_AVAILABLE is False:
        return None

    if _SBERT_MODEL is not None:
        return _SBERT_MODEL

    try:
        from sentence_transformers import SentenceTransformer  # type: ignore

        _SBERT_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        _SBERT_AVAILABLE = True
        logger.info("Loaded sentence-transformers model: all-MiniLM-L6-v2")
        return _SBERT_MODEL
    except Exception:
        _SBERT_AVAILABLE = False
        logger.warning(
            "sentence-transformers unavailable — falling back to hash-based embeddings."
        )
        return None


# ── Constants ────────────────────────────────────────────────────────────────

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
EMBEDDING_DIMENSIONS = 384


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall((text or "").lower())


def _hash_embedding(text: str, dimensions: int) -> list[float]:
    """Original hash-based embedding used as a fallback."""
    tokens = tokenize(text)
    if not tokens:
        return [0.0] * dimensions

    counts = Counter(tokens)
    vector = [0.0] * dimensions
    total = float(sum(counts.values()))
    for token, count in counts.items():
        vector[hash(token) % dimensions] += count / total
    return vector


def build_embedding(text: str, dimensions: int = EMBEDDING_DIMENSIONS) -> list[float]:
    model = _get_sbert_model()
    if model is not None:
        try:
            vec = model.encode(text or "", show_progress_bar=False)
            return vec.tolist()
        except Exception:
            pass
    # Fallback to hash-based embedding
    return _hash_embedding(text, dimensions)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    numerator = sum(a * b for a, b in zip(left, right, strict=False))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return numerator / (left_norm * right_norm)


def matches_filters(
    *,
    url: str,
    updated_at: datetime | str | None,
    site: str = "",
    filetype: str = "",
    date_range: str = "",
) -> bool:
    normalized_url = (url or "").lower()
    normalized_site = site.strip().lower()
    normalized_filetype = filetype.strip().lower().lstrip(".")
    normalized_range = date_range.strip().lower()

    if normalized_site and normalized_site not in normalized_url:
        return False

    if normalized_filetype:
        suffix = f".{normalized_filetype}"
        if not normalized_url.endswith(suffix):
            return False

    if normalized_range:
        parsed = _coerce_datetime(updated_at)
        if parsed is None:
            return False
        cutoff = _range_cutoff(normalized_range)
        if cutoff is not None and parsed < cutoff:
            return False

    return True


def rank_documents(
    query: str,
    documents: Iterable[dict],
    *,
    limit: int = 10,
    site: str = "",
    filetype: str = "",
    date_range: str = "",
) -> list[dict]:
    query_embedding = build_embedding(query)
    ranked: list[dict] = []

    for document in documents:
        url = str(document.get("url", ""))
        if not matches_filters(
            url=url,
            updated_at=document.get("updated_at"),
            site=site,
            filetype=filetype,
            date_range=date_range,
        ):
            continue

        cached_embedding = document.get("_embedding")
        if isinstance(cached_embedding, list) and cached_embedding:
            document_embedding = cached_embedding
        else:
            semantic_text = " ".join(
                str(document.get(key, ""))
                for key in ("title", "summary", "body")
            )
            document_embedding = build_embedding(semantic_text)

        semantic_score = cosine_similarity(query_embedding, document_embedding)
        if semantic_score < 0.40:
            continue

        ranked.append(
            {
                "url": url,
                "title": str(document.get("title", "")),
                "body": str(document.get("body", "")),
                "summary": str(document.get("summary", "")),
                "updated_at": document.get("updated_at"),
                "score": semantic_score,
                "semantic_score": semantic_score,
                "source": "semantic",
            }
        )

    ranked.sort(key=lambda item: item["semantic_score"], reverse=True)
    return ranked[:limit]


def precompute_document_embeddings(documents: Iterable[dict]) -> list[dict]:
    """Batch-encode all documents using the sentence-transformer model.

    Falls back to per-document hash embeddings if the model is unavailable.
    """
    doc_list = list(documents)
    if not doc_list:
        return []

    model = _get_sbert_model()

    if model is not None:
        texts = [
            " ".join(str(doc.get(key, "")) for key in ("title", "summary", "body"))
            for doc in doc_list
        ]
        try:
            vectors = model.encode(texts, batch_size=32, show_progress_bar=False)
            cached: list[dict] = []
            for doc, vec in zip(doc_list, vectors):
                enriched = dict(doc)
                enriched["_embedding"] = vec.tolist()
                cached.append(enriched)
            return cached
        except Exception:
            logger.exception("Batch encoding failed — falling back to hash embeddings.")

    # Fallback: hash-based embeddings one-by-one
    cached = []
    for document in doc_list:
        enriched = dict(document)
        semantic_text = " ".join(
            str(enriched.get(key, ""))
            for key in ("title", "summary", "body")
        )
        enriched["_embedding"] = _hash_embedding(semantic_text, EMBEDDING_DIMENSIONS)
        cached.append(enriched)
    return cached


def _coerce_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _range_cutoff(date_range: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    mapping = {
        "day": timedelta(days=1),
        "week": timedelta(weeks=1),
        "month": timedelta(days=30),
        "year": timedelta(days=365),
    }
    delta = mapping.get(date_range)
    return None if delta is None else now - delta
