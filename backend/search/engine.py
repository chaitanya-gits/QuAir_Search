from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from backend.config import settings
from backend.indexer.es_client import DisabledSearchIndexClient, SearchIndexClient
from backend.ranking.bm25 import rank_with_bm25
from backend.ranking.freshness import apply_freshness_boost
from backend.ranking.fusion import reciprocal_rank_fusion
from backend.ranking.pagerank import apply_pagerank_boost
from backend.search.cache import QueryResponseCache, TTLCache
from backend.search.quantum import (
    apply_quantum_boost,
    count_amplified_candidates,
    simulate_grover_search,
)
from backend.search.query_parser import parse_query
from backend.search.result_builder import build_answer, build_sources
from backend.search.semantic import (
    matches_filters,
    precompute_document_embeddings,
    rank_documents,
)
from backend.search.web_fallback import search_public_web
from backend.storage.postgres import PostgresStorage
from backend.storage.redis import RedisStorage

try:
    import google.generativeai as genai  # type: ignore
    if settings.gemini_api_key:
        genai.configure(api_key=settings.gemini_api_key)
    _GEMINI_AVAILABLE = bool(settings.gemini_api_key)
except Exception:
    _GEMINI_AVAILABLE = False
    genai = None  # type: ignore


logger = logging.getLogger(__name__)


REGION_DOMAINS: dict[str, list[str]] = {
    "IN": [".in", ".co.in"],
    "US": [".com", ".us", ".gov"],
    "GB": [".co.uk", ".uk", ".org.uk"],
    "CA": [".ca"],
    "AU": [".com.au", ".au"],
    "DE": [".de"],
    "FR": [".fr"],
    "IT": [".it"],
    "ES": [".es"],
    "NL": [".nl"],
    "BR": [".com.br", ".br"],
    "MX": [".com.mx", ".mx"],
    "AR": [".com.ar", ".ar"],
    "CO": [".com.co", ".co"],
    "CL": [".cl"],
    "PE": [".pe"],
    "VE": [".ve"],
    "ZA": [".co.za", ".za"],
    "NG": [".ng", ".com.ng"],
    "EG": [".eg"],
    "KE": [".co.ke", ".ke"],
    "ET": [".et"],
    "MA": [".ma"],
    "DZ": [".dz"],
    "TN": [".tn"],
    "GH": [".com.gh", ".gh"],
    "UG": [".ug"],
    "TZ": [".co.tz", ".tz"],
    "CM": [".cm"],
    "SN": [".sn"],
    "SA": [".sa", ".com.sa"],
    "AE": [".ae"],
    "QA": [".qa"],
    "KW": [".kw"],
    "OM": [".om"],
    "BH": [".bh"],
    "JO": [".jo"],
    "LB": [".lb"],
    "IL": [".il", ".co.il"],
    "TR": [".tr", ".com.tr"],
    "IR": [".ir"],
    "IQ": [".iq"],
    "PK": [".pk", ".com.pk"],
    "BD": [".bd", ".com.bd"],
    "NP": [".np", ".com.np"],
    "LK": [".lk"],
    "MM": [".mm"],
    "TH": [".th", ".co.th"],
    "VN": [".vn"],
    "MY": [".my", ".com.my"],
    "SG": [".sg", ".com.sg"],
    "ID": [".id", ".co.id"],
    "PH": [".ph", ".com.ph"],
    "KR": [".kr", ".co.kr"],
    "JP": [".jp", ".co.jp"],
    "CN": [".cn", ".com.cn"],
    "TW": [".tw", ".com.tw"],
    "HK": [".hk", ".com.hk"],
    "NZ": [".nz", ".co.nz"],
    "RU": [".ru"],
    "UA": [".ua", ".com.ua"],
    "PL": [".pl"],
    "SE": [".se"],
    "NO": [".no"],
    "DK": [".dk"],
    "FI": [".fi"],
    "IE": [".ie"],
    "PT": [".pt"],
    "BE": [".be"],
    "CH": [".ch"],
    "AT": [".at"],
    "CZ": [".cz"],
    "HU": [".hu"],
    "RO": [".ro"],
    "GR": [".gr"],
    "BG": [".bg"],
    "HR": [".hr"],
    "RS": [".rs"],
    "SK": [".sk"],
    "SI": [".si"],
    "LT": [".lt"],
    "LV": [".lv"],
    "EE": [".ee"],
    "IS": [".is"],
    "LU": [".lu"],
    "MT": [".mt"],
    "CY": [".cy"],
    "GE": [".ge"],
    "KZ": [".kz"],
    "UZ": [".uz"],
    "AZ": [".az"],
    "MN": [".mn"],
    "KH": [".kh"],
    "LA": [".la"],
    "BT": [".bt"],
    "AF": [".af"],
    "BY": [".by"],
    "MD": [".md"],
    "AL": [".al"],
    "ME": [".me"],
}


def _url_matches_region(url: str, region: str) -> bool:
    """Check if a URL's domain matches any TLD associated with the region."""
    tlds = REGION_DOMAINS.get(region.upper(), [])
    if not tlds:
        return False
    from urllib.parse import urlparse
    try:
        hostname = urlparse(url).hostname or ""
    except Exception:
        return False
    hostname = hostname.lower().rstrip(".")
    for tld in tlds:
        if hostname.endswith(tld) or hostname.endswith(tld + "."):
            return True
    return False


def apply_region_boost(results: list[dict], region: str) -> list[dict]:
    """Boost scores for results that match the user's selected region."""
    if not region or region.upper() == "US":
        # US is the default/global region, no special boosting needed
        return results
    for result in results:
        url = str(result.get("url", ""))
        if _url_matches_region(url, region):
            result["score"] = result.get("score", 0.0) * 1.5
            result.setdefault("region_match", True)
    return results


# ── Safe Search: domain and keyword blocklists ───────────────────────────

ADULT_DOMAINS: set[str] = {
    "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com",
    "redtube.com", "youporn.com", "tube8.com", "spankbang.com",
    "chaturbate.com", "stripchat.com", "bongacams.com", "cam4.com",
    "livejasmin.com", "myfreecams.com", "onlyfans.com", "fansly.com",
    "brazzers.com", "naughtyamerica.com", "realitykings.com",
    "bangbros.com", "mofos.com", "twistys.com", "digitalplayground.com",
    "pornhd.com", "beeg.com", "eporner.com", "txxx.com", "hclips.com",
    "fuq.com", "tnaflix.com", "drtuber.com", "sunporno.com",
    "4tube.com", "porntrex.com", "ixxx.com", "pornicom.com",
    "sex.com", "literotica.com", "imagefap.com", "rule34.xxx",
    "e-hentai.org", "nhentai.net", "hanime.tv", "hentaihaven.xxx",
    "danbooru.donmai.us", "gelbooru.com", "sankakucomplex.com",
    "motherless.com", "heavy-r.com", "efukt.com", "slutload.com",
    "ashemaletube.com", "trannytube.tv",
    "adultfriendfinder.com", "fetlife.com", "swapfinder.com",
    "flirt4free.com", "imlive.com", "streamate.com", "camsoda.com",
    "nudevista.com", "alohatube.com", "thumbzilla.com",
}

VIOLENCE_DOMAINS: set[str] = {
    "bestgore.fun", "theync.com", "goregrish.com",
    "documenting.com", "kaotic.com", "crazyshit.com",
    "liveleak.com", "shockgore.com", "seegore.com",
    "hoodsite.com", "miscopy.com",
}

UNSAFE_KEYWORDS: list[str] = [
    "porn", "xxx", "nude", "naked", "hentai", "nsfw",
    "sex video", "adult video", "erotic", "fetish",
    "gore", "beheading", "execution video", "murder video",
    "torture video", "graphic violence", "death video",
]


def apply_safe_search_filter(
    results: list[dict], level: str,
) -> list[dict]:
    """Filter results based on Safe Search level.

    - off      → no filtering
    - moderate → remove results from adult domains
    - strict   → remove adult + violence domains AND filter unsafe snippets
    """
    level = (level or "moderate").lower().strip()
    if level == "off":
        return results

    blocked_domains = set(ADULT_DOMAINS)
    if level == "strict":
        blocked_domains |= VIOLENCE_DOMAINS

    from urllib.parse import urlparse

    filtered: list[dict] = []
    for item in results:
        url = str(item.get("url", "")).lower()
        try:
            host = urlparse(url).hostname or ""
            host = host.replace("www.", "")
        except Exception:
            host = ""

        # Block entire domain
        if any(host == d or host.endswith("." + d) for d in blocked_domains):
            continue

        # In strict mode, also check snippet text for unsafe keywords
        if level == "strict":
            snippet = (
                str(item.get("summary", "")) + " " + str(item.get("title", ""))
            ).lower()
            if any(kw in snippet for kw in UNSAFE_KEYWORDS):
                continue

        filtered.append(item)

    return filtered


@dataclass(slots=True)
class SearchFilters:
    site: str = ""
    filetype: str = ""
    date_range: str = ""
    region: str = ""
    safe_search: str = "moderate"


@dataclass(slots=True)
class SearchEngine:
    postgres: PostgresStorage
    redis: RedisStorage
    search_index: SearchIndexClient | DisabledSearchIndexClient
    _documents_cache: TTLCache[list[dict[str, Any]]] = field(init=False)
    _pagerank_cache: TTLCache[dict[str, float]] = field(init=False)
    _response_cache: QueryResponseCache = field(init=False)

    def __post_init__(self) -> None:
        self._documents_cache = TTLCache(settings.document_cache_ttl_seconds)
        self._pagerank_cache = TTLCache(settings.pagerank_cache_ttl_seconds)
        self._response_cache = QueryResponseCache(
            ttl_seconds=settings.search_response_cache_ttl_seconds,
            max_entries=settings.search_response_cache_max_entries,
        )

    def invalidate_caches(self) -> None:
        """Drop cached corpora, PageRank, and response payloads (call after reindex)."""

        self._documents_cache.invalidate()
        self._pagerank_cache.invalidate()
        self._response_cache.invalidate()

    async def search(self, query: str, limit: int = 30, filters: SearchFilters | None = None, request: Any | None = None) -> dict:
        start_time = asyncio.get_running_loop().time()
        filters = filters or SearchFilters()
        parsed_query = parse_query(query)
        search_queries = [item for item in parsed_query.search_queries if item]

        if not search_queries:
            return self._build_empty_payload(parsed_query.normalized)

        primary_query = search_queries[0]

        cache_key = (
            parsed_query.normalized,
            filters.site.strip().lower(),
            filters.filetype.strip().lower(),
            filters.date_range.strip().lower(),
            filters.region.strip().upper(),
            int(limit),
        )
        cached_payload = await self._response_cache.get(cache_key)
        if cached_payload is not None:
            await self._safe_record_query(parsed_query.normalized)
            return cached_payload

        mode_timeout = settings.search_mode_timeout_seconds

        async def _bm25() -> list[dict]:
            return await rank_with_bm25(
                self.postgres,
                primary_query,
                limit=limit * 3,
                site=filters.site,
                filetype=filters.filetype,
                date_range=filters.date_range,
            )

        async def _opensearch() -> list[dict]:
            raw_results = await self.search_index.text_search(primary_query, limit=limit)
            return [
                {**result, "source": "opensearch"}
                for result in raw_results
                if matches_filters(
                    url=str(result.get("url", "")),
                    updated_at=result.get("updated_at"),
                    site=filters.site,
                    filetype=filters.filetype,
                    date_range=filters.date_range,
                )
            ]



        bm25_task = asyncio.create_task(self._run_with_timeout("bm25", _bm25(), mode_timeout, []))
        opensearch_task = asyncio.create_task(
            self._run_with_timeout("opensearch", _opensearch(), mode_timeout, [])
        )
        web_task = asyncio.create_task(
            self._run_with_timeout(
                "web",
                search_public_web(primary_query, limit=limit, region=filters.region, safe_search=filters.safe_search),
                settings.search_web_fallback_timeout_seconds,
                [],
            )
        )
        pagerank_task = asyncio.create_task(
            self._run_with_timeout(
                "pagerank",
                self._pagerank_cache.get(self._load_pagerank_scores),
                mode_timeout,
                {},
            )
        )
        record_task = asyncio.create_task(self._safe_record_query(parsed_query.normalized))
        bm25_results, opensearch_results, web_results, pagerank_scores = await asyncio.gather(
            bm25_task,
            opensearch_task,
            web_task,
            pagerank_task,
        )
        document_count = await self.postgres.count_pages()

        ranked_results = reciprocal_rank_fusion([bm25_results, opensearch_results, web_results])
        ranked_results = apply_pagerank_boost(ranked_results, pagerank_scores)
        ranked_results = apply_quantum_boost(ranked_results)
        ranked_results = apply_freshness_boost(ranked_results)
        ranked_results = apply_region_boost(ranked_results, filters.region)
        
        # Massive global boost for official sites and Wikipedia
        query_normalized = query.lower().replace(" ", "")
        for item in ranked_results:
            url = str(item.get("url", "")).lower()
            if query_normalized and query_normalized in url:
                # If the domain itself contains the query (like quinfosys in quinfosys.com)
                item["score"] = item.get("score", 0.0) + 50.0
            elif "wikipedia.org" in url:
                item["score"] = item.get("score", 0.0) + 20.0
                
        ranked_results.sort(key=lambda item: item["score"], reverse=True)
        
        # Filter out duplicate websites (only 1 result per hostname)
        unique_results = []
        seen_hosts = set()
        from urllib.parse import urlparse
        for item in ranked_results:
            try:
                host = urlparse(str(item.get("url", ""))).hostname or ""
                host = host.lower().replace("www.", "")
            except Exception:
                host = ""
            if host and host not in seen_hosts:
                seen_hosts.add(host)
                unique_results.append(item)
            elif not host:
                unique_results.append(item)
        ranked_results = unique_results

        # Apply Safe Search filtering
        ranked_results = apply_safe_search_filter(ranked_results, filters.safe_search)


        fallback_mode = ""
        if web_results and not (bm25_results or opensearch_results):
            fallback_mode = "web"

        quantum_metrics = simulate_grover_search(
            corpus_size=max(document_count, len(ranked_results)),
            candidate_count=max(1, len(web_results) or len(ranked_results)),
            amplified_candidates=count_amplified_candidates(ranked_results),
        )
        source_payload = build_sources(ranked_results, limit=limit)

        # Spell correction: detect misspelled queries
        corrected_query = await self._suggest_spelling_correction(query)

        final_answer = await self._generate_ai_summary(primary_query, source_payload)
        if not final_answer or final_answer == "insufficient data":
            final_answer = build_answer(ranked_results)
        if not final_answer or final_answer == "insufficient data":
            final_answer = self._build_empty_answer(
                document_count=document_count,
                filters=filters,
            )

        index_status = await self._build_index_status()
        payload = {
            "query": parsed_query.normalized,
            "search_queries": search_queries,
            "sources": source_payload,
            "final_answer": final_answer,
            "search_modes": ["bm25", "opensearch", "web", "quantum-sim"],
            "applied_filters": {
                "site": filters.site,
                "filetype": filters.filetype,
                "date_range": filters.date_range,
                "region": filters.region,
                "safe_search": filters.safe_search,
            },
            "fallback_mode": fallback_mode,
            "empty_state": self._build_empty_state_message(
                document_count=document_count,
                source_count=len(source_payload),
                filters=filters,
                fallback_mode=fallback_mode,
            ),
            "quantum": quantum_metrics,
            "analytics": self._build_analytics(
                ranked_results,
                source_payload,
                web_results,
                filters,
            ),
            "index_status": index_status,
            "corrected_query": corrected_query,
            "original_query": query,
        }

        await self._response_cache.set(cache_key, payload)
        if request is not None:
            response_ms = round((asyncio.get_running_loop().time() - start_time) * 1000)
            asyncio.create_task(
                self._safe_record_search_event(
                    request,
                    parsed_query,
                    payload,
                    filters,
                    int(response_ms) if response_ms is not None else 0,
                )
            )
        await record_task
        return payload

    async def _safe_record_search_event(
        self,
        request: Any,
        parsed_query,
        payload: dict,
        filters: SearchFilters,
        response_ms: int,
    ) -> None:
        try:
            session = getattr(request.state, "session", None)
            await self.postgres.record_search_event(
                user_id=str(session["user_id"]) if session else None,
                session_id=str(session["id"]) if session else None,
                anonymous_id=request.headers.get("x-anonymous-id", ""),
                query_raw=str(payload.get("original_query", parsed_query.normalized)),
                query_normalized=parsed_query.normalized,
                result_count=len(payload.get("sources", [])),
                response_ms=response_ms,
                ip_address=request.client.host if request.client else "",
                user_agent=request.headers.get("user-agent", ""),
                region=filters.region,
                display_language=str(payload.get("applied_filters", {}).get("display_language", "en-US")),
                safe_search=filters.safe_search,
                has_attachment=False,
                search_tab=str(payload.get("applied_filters", {}).get("search_tab", "all")),
            )
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to record search event")

    @staticmethod
    async def _drain_cancelled_task(task: asyncio.Task[Any]) -> None:
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            return

    async def _run_with_timeout(self, name: str, coro, timeout: float, default):
        try:
            return await asyncio.wait_for(coro, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("search mode %s exceeded %.2fs timeout", name, timeout)
            return default
        except Exception:  # pragma: no cover - defensive
            logger.exception("search mode %s failed", name)
            return default

    async def _safe_record_query(self, normalized_query: str) -> None:
        try:
            await self.redis.record_query(normalized_query)
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to record query for trending")

    @staticmethod
    async def _generate_ai_summary(query: str, sources: list[dict]) -> str:
        """Generate a 4-5 sentence encyclopedic About summary using Gemini.

        Prefers Wikipedia sources so the About section reads like a clean factual
        overview rather than a mix of news articles.
        """
        if not _GEMINI_AVAILABLE or not sources:
            return "insufficient data"
        try:
            import re as _re

            # Prefer Wikipedia sources for the About text
            wiki_sources = [
                s for s in sources
                if "wikipedia.org" in str(s.get("url", "")).lower()
            ]
            chosen = wiki_sources[:3] if wiki_sources else sources[:4]

            snippets = []
            for s in chosen:
                title = (s.get("title") or "").strip()
                summary = (s.get("summary") or "").strip()
                if summary:
                    snippets.append(summary)
                elif title:
                    snippets.append(title)

            if not snippets:
                return "insufficient data"

            context = "\n".join(snippets)
            source_note = "Wikipedia" if wiki_sources else "web search results"
            prompt = (
                f'You are an encyclopedia assistant. Using only the {source_note} '
                f'content below about "{query}", write a concise 3-4 sentence '
                f"factual overview in the style of an encyclopedia entry. "
                f"Focus on who/what the subject is, key facts, and notable attributes. "
                f"Do NOT mention news events, social media activity, recent songs, or anything time-sensitive. "
                f"Do NOT use any markdown symbols like *, #, or bullet points. "
                f"Write in plain prose only.\n\nContent:\n{context}\n\nAbout:"
            )
            loop = asyncio.get_event_loop()
            model = genai.GenerativeModel(settings.gemini_model)
            response = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: model.generate_content(prompt)),
                timeout=8.0,
            )
            text = (response.text or "").strip()
            text = _re.sub(r"[*#`]+", "", text).strip()
            return text if len(text) > 20 else "insufficient data"
        except Exception:
            logger.exception("Gemini AI summary failed")
            return "insufficient data"

    @staticmethod
    async def _suggest_spelling_correction(query: str) -> str | None:
        """Use Gemini to detect and correct spelling mistakes in search queries.

        Returns the corrected query if a mistake was detected, or None if the
        query appears correct.
        """
        if not _GEMINI_AVAILABLE:
            return None
        try:
            prompt = (
                f'You are a spell-checker for a search engine. '
                f'Given the search query below, determine if it contains any spelling mistakes. '
                f'If it does, respond with ONLY the corrected query (nothing else). '
                f'If the query is already correct or is a proper noun/brand name/abbreviation, '
                f'respond with exactly "CORRECT" (nothing else).\n\n'
                f'Query: {query}\n\nResponse:'
            )
            loop = asyncio.get_event_loop()
            model = genai.GenerativeModel(settings.gemini_model)
            response = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: model.generate_content(prompt)),
                timeout=3.0,
            )
            text = (response.text or "").strip()
            if not text or text.upper() == "CORRECT" or text.lower() == query.lower():
                return None
            return text
        except Exception:
            logger.debug("Spell correction failed for query: %s", query)
            return None

    async def _load_documents(self) -> list[dict[str, Any]]:
        raw_documents = await self.postgres.fetch_page_documents(
            limit=settings.document_corpus_limit,
        )
        return precompute_document_embeddings(raw_documents)

    async def _load_pagerank_scores(self) -> dict[str, float]:
        try:
            return await self.postgres.compute_all_pagerank_scores()
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to compute PageRank scores")
            return {}

    async def _build_index_status(self) -> dict:
        postgres_count, redis_ok, opensearch_ok = await asyncio.gather(
            self.postgres.count_pages(),
            self.redis.healthcheck(),
            self.search_index.healthcheck(),
        )
        return {
            "postgres_documents": postgres_count,
            "redis_connected": redis_ok,
            "opensearch_connected": opensearch_ok,
        }

    @staticmethod
    def _build_empty_payload(normalized_query: str) -> dict:
        return {
            "query": normalized_query,
            "search_queries": [],
            "sources": [],
            "final_answer": "insufficient data",
        }

    async def _build_fallback_results(
        self,
        query: str,
        *,
        filters: SearchFilters,
        limit: int,
        web_task: asyncio.Task[list[dict]] | None = None,
    ) -> tuple[list[dict], str]:
        if web_task is not None:
            try:
                web_results = await web_task
            except (asyncio.CancelledError, asyncio.TimeoutError):
                web_results = []
            except Exception:  # pragma: no cover - defensive
                logger.exception("web fallback failed")
                web_results = []
        else:
            try:
                web_results = await asyncio.wait_for(
                    search_public_web(query, limit=limit),
                    timeout=settings.search_web_fallback_timeout_seconds,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    "web fallback exceeded %.2fs timeout",
                    settings.search_web_fallback_timeout_seconds,
                )
                web_results = []
            except Exception:  # pragma: no cover - defensive
                logger.exception("web fallback failed")
                web_results = []

        filtered_web_results = [
            result
            for result in web_results
            if matches_filters(
                url=str(result.get("url", "")),
                updated_at=result.get("updated_at"),
                site=filters.site,
                filetype=filters.filetype,
                date_range=filters.date_range,
            )
        ]
        if filtered_web_results:
            return filtered_web_results[:limit], "web"

        return [], ""

    @staticmethod
    def _build_empty_answer(document_count: int, filters: SearchFilters) -> str:
        if document_count == 0:
            return "No indexed pages are available yet. Showing live web fallback results when available."
        if filters.site or filters.filetype or filters.date_range:
            return "No results matched the active filters. Try broadening the search filters or query."
        return "No direct match was found in the current index."

    @staticmethod
    def _build_empty_state_message(
        *,
        document_count: int,
        source_count: int,
        filters: SearchFilters,
        fallback_mode: str,
    ) -> str:
        if source_count and fallback_mode == "web":
            return ""
        if source_count and fallback_mode:
            return "No exact match found. Showing the freshest indexed pages instead."
        if document_count == 0:
            return "Index is empty. Run a crawl or ingest pipeline first."
        if filters.site or filters.filetype or filters.date_range:
            return "No pages matched the current filters."
        return "No matching results found in the indexed corpus."

    @staticmethod
    def _build_analytics(
        ranked_results: list[dict],
        sources: list[dict],
        semantic_results: list[dict],
        filters: SearchFilters,
    ) -> dict:
        source_mix: dict[str, int] = {}
        pagerank_total = 0.0
        quantum_total = 0.0
        for result in ranked_results[: len(sources)]:
            for source_name in result.get("sources", []):
                source_mix[source_name] = source_mix.get(source_name, 0) + 1
            pagerank_total += float(result.get("pagerank_score", 0.0))
            quantum_total += float(result.get("quantum_score", 0.0))

        result_count = len(sources)
        return {
            "result_count": result_count,
            "semantic_hits": len(semantic_results),
            "average_pagerank": round(pagerank_total / result_count, 4) if result_count else 0.0,
            "average_quantum": round(quantum_total / result_count, 4) if result_count else 0.0,
            "source_mix": source_mix,
            "filters_active": int(bool(filters.site) + bool(filters.filetype) + bool(filters.date_range)),
        }
