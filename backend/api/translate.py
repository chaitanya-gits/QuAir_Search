from __future__ import annotations

import asyncio
import concurrent.futures
import hashlib
import json
import logging
from collections import OrderedDict
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

_thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)

_BATCH_TIMEOUT = 120
_MAX_TRANSLATE_WORKERS = 8
_GTX_URL = "https://translate.googleapis.com/translate_a/single"
_GTX_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; QuantumSEO/2.0; +https://localhost)",
}

_MEM_ORDERED: OrderedDict[str, list[str]] = OrderedDict()
_MEM_MAX_ENTRIES = 1024


def _batch_store_key(dest: str, src: str, texts: tuple[str, ...]) -> str:
    raw = json.dumps({"d": dest, "s": src, "t": texts}, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def memo_batch_get(dest: str, src: str, texts: tuple[str, ...]) -> list[str] | None:
    key = _batch_store_key(dest, src, texts)
    hit = _MEM_ORDERED.get(key)
    if hit is None:
        return None
    _MEM_ORDERED.move_to_end(key)
    return list(hit)


def memo_batch_put(dest: str, src: str, texts: tuple[str, ...], translations: list[str]) -> None:
    key = _batch_store_key(dest, src, texts)
    _MEM_ORDERED[key] = list(translations)
    _MEM_ORDERED.move_to_end(key)
    while len(_MEM_ORDERED) > _MEM_MAX_ENTRIES:
        _MEM_ORDERED.popitem(last=False)

class TranslateRequest(BaseModel):
    texts: list[str]
    target_language: str
    source_language: str = "auto"


class TranslateResponse(BaseModel):
    translations: list[str] = Field(default_factory=list)


def _normalize_language(code: str) -> str:
    return code.strip().lower().replace("_", "-").split("-", 1)[0]


def _extract_gtx_text(payload: Any) -> str:
    if not isinstance(payload, list) or not payload:
        return ""
    segments = payload[0]
    if not isinstance(segments, list):
        return ""
    parts: list[str] = []
    for segment in segments:
        if isinstance(segment, list) and segment and isinstance(segment[0], str):
            parts.append(segment[0])
    return "".join(parts)


def _translate_one_gtx(text: str, dest_lang: str, src_lang: str) -> str:
    params: dict[str, str] = {
        "client": "gtx",
        "sl": src_lang,
        "tl": dest_lang,
        "dt": "t",
        "q": text,
    }
    try:
        with httpx.Client(timeout=20.0, headers=_GTX_HEADERS) as client:
            response = client.get(_GTX_URL, params=params)
            response.raise_for_status()
            translated = _extract_gtx_text(response.json())
            if translated.strip():
                return translated
    except Exception as exc:
        logger.warning("GTX translation failed for '%s': %s", text[:30], exc)
    return text


def _translate_keys_worker(keys: list[str], dest_lang: str, src_lang: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for key in keys:
        out[key] = _translate_one_gtx(key, dest_lang, src_lang)
    return out


def _translate_batch_sync(texts: list[str], dest: str, src: str) -> list[str]:
    dest_lang = _normalize_language(dest)
    src_lang = _normalize_language(src)
    results: list[str] = list(texts)

    if dest_lang == src_lang and src_lang != "auto":
        return results

    unique_texts: dict[str, str] = {}
    for text in texts:
        key = text.strip()
        if key and key not in unique_texts:
            unique_texts[key] = key

    keys_list = list(unique_texts.keys())
    if not keys_list:
        return results

    if len(keys_list) <= 4:
        merged = _translate_keys_worker(keys_list, dest_lang, src_lang)
    else:
        n_workers = min(_MAX_TRANSLATE_WORKERS, max(2, len(keys_list) // 3))
        chunks: list[list[str]] = [[] for _ in range(n_workers)]
        for i, key in enumerate(keys_list):
            chunks[i % n_workers].append(key)
        chunks = [c for c in chunks if c]
        merged: dict[str, str] = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(chunks)) as pool:
            futures = [
                pool.submit(_translate_keys_worker, chunk, dest_lang, src_lang)
                for chunk in chunks
            ]
            for fut in concurrent.futures.as_completed(futures):
                merged.update(fut.result())

    for key in keys_list:
        unique_texts[key] = merged.get(key, key)

    for i, text in enumerate(texts):
        key = text.strip()
        if key and key in unique_texts:
            results[i] = unique_texts[key]

    return results


@router.post("/translate", response_model=TranslateResponse)
async def translate_texts(body: TranslateRequest) -> TranslateResponse:
    if not body.texts:
        return TranslateResponse(translations=[])

    dest_lang = _normalize_language(body.target_language)
    src_lang = _normalize_language(body.source_language)
    texts_sig = tuple(body.texts)
    cached_batch = memo_batch_get(dest_lang, src_lang, texts_sig)
    if cached_batch is not None and len(cached_batch) == len(body.texts):
        return TranslateResponse(translations=cached_batch)

    loop = asyncio.get_running_loop()
    future = loop.run_in_executor(
        _thread_pool,
        _translate_batch_sync,
        body.texts,
        body.target_language,
        body.source_language,
    )
    try:
        translations = await asyncio.wait_for(future, timeout=_BATCH_TIMEOUT)
    except asyncio.TimeoutError:
        logger.warning("Translation batch timed out after %ds", _BATCH_TIMEOUT)
        translations = list(body.texts)
    except Exception as exc:
        logger.warning("Translation batch failed: %s", exc)
        translations = list(body.texts)

    if len(translations) == len(body.texts):
        memo_batch_put(dest_lang, src_lang, texts_sig, translations)

    return TranslateResponse(translations=translations)
