from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import asyncpg

from backend.config import settings
from backend.ranking.pagerank import compute_pagerank_scores
from backend.search.semantic import matches_filters


@dataclass(slots=True)
class SearchRecord:
    url: str
    title: str
    body: str
    summary: str
    updated_at: datetime
    score: float


SEARCH_PAGES_SQL = """
SELECT
  url,
  title,
  body,
  summary,
  updated_at,
  ts_rank_cd(search_document, plainto_tsquery('english', $1)) AS score
FROM pages
WHERE search_document @@ plainto_tsquery('english', $1)
ORDER BY score DESC, updated_at DESC
LIMIT $2
"""

LATEST_PAGES_SQL = """
SELECT url, title, body, summary, updated_at, 1.0::float AS score
FROM pages
ORDER BY updated_at DESC
LIMIT $1
"""

PAGERANK_NODES_SQL = "SELECT url FROM pages"

PAGERANK_LINKS_SQL = """
SELECT source_url, target_url
FROM page_links
"""

UPSERT_PAGE_SQL = """
INSERT INTO pages (
  url,
  title,
  body,
  summary,
  last_seed_query,
  outbound_links,
  updated_at,
  search_document
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6::jsonb,
  NOW(),
  to_tsvector('english', $2 || ' ' || $3)
)
ON CONFLICT (url) DO UPDATE
SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  summary = EXCLUDED.summary,
  last_seed_query = EXCLUDED.last_seed_query,
  outbound_links = EXCLUDED.outbound_links,
  updated_at = NOW(),
  search_document = to_tsvector('english', EXCLUDED.title || ' ' || EXCLUDED.body)
"""

DELETE_PAGE_LINKS_SQL = "DELETE FROM page_links WHERE source_url = $1"

INSERT_PAGE_LINK_SQL = """
INSERT INTO page_links (source_url, target_url)
VALUES ($1, $2)
ON CONFLICT (source_url, target_url) DO NOTHING
"""

FETCH_PAGE_DOCUMENTS_SQL = """
SELECT url, title, body, summary, updated_at
FROM pages
ORDER BY updated_at DESC
LIMIT $1
"""

UPSERT_USER_SQL = """
INSERT INTO users (email, display_name, handle, avatar_url, provider, provider_id)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (provider, provider_id)
  WHERE provider_id IS NOT NULL
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url   = EXCLUDED.avatar_url,
    updated_at   = NOW()
RETURNING id, email, display_name, handle, avatar_url, provider, is_admin, created_at
"""

GET_USER_BY_EMAIL_SQL = """
SELECT id, email, display_name, handle, avatar_url, provider, provider_id,
       is_active, is_admin, created_at, updated_at
FROM users WHERE email = $1
"""

GET_USER_BY_ID_SQL = """
SELECT id, email, display_name, handle, avatar_url, provider, provider_id,
       is_active, is_admin, created_at, updated_at
FROM users WHERE id = $1
"""

GET_USER_SETTINGS_SQL = """
SELECT settings, updated_at
FROM user_settings
WHERE user_id = $1
"""

UPSERT_USER_SETTINGS_SQL = """
INSERT INTO user_settings (user_id, settings, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (user_id) DO UPDATE
SET settings = EXCLUDED.settings,
    updated_at = NOW()
RETURNING settings, updated_at
"""

CREATE_SESSION_SQL = """
INSERT INTO user_sessions
  (user_id, session_token, ip_address, user_agent, device_type, country_code)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, session_token, created_at, expires_at
"""

GET_SESSION_SQL = """
SELECT s.id, s.user_id, s.session_token, s.is_active, s.expires_at,
       s.last_seen_at, s.ip_address, s.user_agent,
       u.email, u.display_name, u.avatar_url, u.is_admin, u.provider
FROM user_sessions s
JOIN users u ON u.id = s.user_id
WHERE s.session_token = $1
  AND s.is_active = TRUE
  AND s.expires_at > NOW()
"""

TOUCH_SESSION_SQL = """
UPDATE user_sessions SET last_seen_at = NOW() WHERE session_token = $1
"""

INVALIDATE_SESSION_SQL = """
UPDATE user_sessions SET is_active = FALSE WHERE session_token = $1
"""

INSERT_LOGIN_EVENT_SQL = """
INSERT INTO login_events (user_id, email, provider, success, ip_address, user_agent, failure_reason)
VALUES ($1, $2, $3, $4, $5, $6, $7)
"""

INSERT_SEARCH_EVENT_SQL = """
INSERT INTO search_events
  (user_id, session_id, anonymous_id, query_raw, query_normalized,
   result_count, response_ms, ip_address, user_agent, region,
   display_language, safe_search, has_attachment, search_tab)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING id
"""

INSERT_CLICK_EVENT_SQL = """
INSERT INTO click_events
  (user_id, session_id, anonymous_id, search_event_id,
   result_url, result_title, result_domain, result_rank, query_raw,
   ip_address, user_agent, referrer_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
"""

INSERT_IMPRESSION_EVENT_SQL = """
INSERT INTO impression_events
  (user_id, session_id, anonymous_id, search_event_id, event_type, payload)
VALUES ($1, $2, $3, $4, $5, $6::jsonb)
"""

LIST_USERS_SQL = """
SELECT id, email, display_name, handle, avatar_url, provider,
       is_active, is_admin, created_at, updated_at
FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2
"""

COUNT_USERS_SQL = "SELECT COUNT(*) FROM users"

USER_SEARCH_HISTORY_SQL = """
SELECT query_raw, query_normalized, result_count, response_ms, occurred_at
FROM search_events
WHERE user_id = $1
ORDER BY occurred_at DESC
LIMIT $2
"""

USER_CLICK_HISTORY_SQL = """
SELECT result_url, result_title, result_domain, result_rank, query_raw, occurred_at
FROM click_events
WHERE user_id = $1
ORDER BY occurred_at DESC
LIMIT $2
"""

ADMIN_USER_ACTIVITY_SQL = """
SELECT
  u.id AS user_id,
  u.display_name,
  u.email,
  u.provider,
  u.created_at AS signed_up_at,
  se.id AS search_event_id,
  se.query_raw,
  se.query_normalized,
  se.result_count,
  se.response_ms,
  se.region,
  se.safe_search,
  se.occurred_at AS searched_at,
  ce.result_url AS visited_url,
  ce.result_title AS visited_title,
  ce.result_domain AS visited_domain,
  ce.occurred_at AS visited_at
FROM search_events se
JOIN users u ON u.id = se.user_id
LEFT JOIN LATERAL (
  SELECT result_url, result_title, result_domain, occurred_at
  FROM click_events ce
  WHERE ce.search_event_id = se.id
  ORDER BY occurred_at DESC
  LIMIT 1
) ce ON TRUE
ORDER BY se.occurred_at DESC
LIMIT $1 OFFSET $2
"""

COUNT_ADMIN_USER_ACTIVITY_SQL = """
SELECT COUNT(*)
FROM search_events
WHERE user_id IS NOT NULL
"""

ADMIN_USER_ACTIVITY_REPORT_SQL = """
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM user_sessions WHERE is_active = TRUE) AS active_sessions,
  (SELECT COUNT(*) FROM search_events WHERE user_id IS NOT NULL) AS identified_searches,
  (SELECT COUNT(*) FROM click_events WHERE user_id IS NOT NULL) AS identified_clicks,
  (SELECT COUNT(*) FROM login_events WHERE success = TRUE) AS successful_logins
"""

ADMIN_USER_ACTIVITY_VIEW_SAMPLE_SQL = """
SELECT *
FROM admin_user_activity_view
ORDER BY searched_at DESC
LIMIT $1
"""


class PostgresStorage:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._pool: asyncpg.Pool | None = None

    async def _ensure_schema(self) -> None:
        """Apply SQL migrations (idempotent) on startup."""
        migrations_dir = Path(__file__).resolve().parent.parent / "db" / "migrations"
        if not migrations_dir.exists():
            return

        async with self.pool.acquire() as connection:
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

            applied = {
                row["id"]
                for row in await connection.fetch("SELECT id FROM schema_migrations")
            }

            for migration_path in sorted(migrations_dir.glob("*.sql")):
                migration_id = migration_path.name
                if migration_id in applied:
                    continue
                sql = migration_path.read_text(encoding="utf-8")
                if not sql.strip():
                    continue
                async with connection.transaction():
                    await connection.execute(sql)
                    await connection.execute(
                        "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
                        migration_id,
                    )

    async def connect(self) -> None:
        if self._pool is None:
            ssl_arg = True if "neon.tech" in self._database_url or "sslmode=require" in self._database_url else None
            self._pool = await asyncpg.create_pool(
                self._database_url,
                min_size=settings.postgres_min_pool_size,
                max_size=settings.postgres_max_pool_size,
                ssl=ssl_arg,
            )
            await self._ensure_schema()

    async def disconnect(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    @property
    def is_available(self) -> bool:
        return self._pool is not None

    @property
    def pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("Postgres pool has not been initialized.")
        return self._pool

    async def healthcheck(self) -> bool:
        try:
            await self.pool.fetchval("SELECT 1")
            return True
        except Exception:
            return False

    async def count_pages(self) -> int:
        count = await self.pool.fetchval("SELECT COUNT(*) FROM pages")
        return int(count)

    async def search_pages(
        self,
        query: str,
        limit: int = 10,
        *,
        site: str = "",
        filetype: str = "",
        date_range: str = "",
    ) -> list[SearchRecord]:
        rows = await self.pool.fetch(SEARCH_PAGES_SQL, query, max(limit * 5, limit))
        records = [SearchRecord(**dict(row)) for row in rows]
        filtered_records = [
            row
            for row in records
            if matches_filters(
                url=row.url,
                updated_at=row.updated_at,
                site=site,
                filetype=filetype,
                date_range=date_range,
            )
        ]
        return filtered_records[:limit]

    async def latest_pages(self, limit: int = 10) -> list[SearchRecord]:
        rows = await self.pool.fetch(LATEST_PAGES_SQL, limit)
        return [SearchRecord(**dict(row)) for row in rows]

    async def get_pagerank_scores(self, urls: list[str]) -> dict[str, float]:
        if not urls:
            return {}

        scores = await self.compute_all_pagerank_scores()
        return {url: float(scores.get(url, 0.0)) for url in urls}

    async def compute_all_pagerank_scores(self) -> dict[str, float]:
        """Compute PageRank over the full page graph once (for caching)."""

        node_rows = await self.pool.fetch(PAGERANK_NODES_SQL)
        link_rows = await self.pool.fetch(PAGERANK_LINKS_SQL)
        return compute_pagerank_scores(
            [(str(row["source_url"]), str(row["target_url"])) for row in link_rows],
            nodes=[str(row["url"]) for row in node_rows],
        )

    async def upsert_page(
        self,
        *,
        url: str,
        title: str,
        body: str,
        summary: str,
        outbound_links: list[str],
        last_seed_query: str = "",
    ) -> None:
        async with self.pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute(
                    UPSERT_PAGE_SQL,
                    url,
                    title,
                    body,
                    summary,
                    last_seed_query,
                    outbound_links,
                )
                await connection.execute(DELETE_PAGE_LINKS_SQL, url)

                if outbound_links:
                    link_rows = [(url, target_url) for target_url in outbound_links]
                    await connection.executemany(INSERT_PAGE_LINK_SQL, link_rows)

    async def fetch_page_documents(self, limit: int = 500) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(FETCH_PAGE_DOCUMENTS_SQL, limit)
        return [dict(row) for row in rows]

    # ── User management ──────────────────────────────────────────────────────
    async def upsert_oauth_user(
        self,
        *,
        email: str,
        display_name: str,
        handle: str,
        avatar_url: str,
        provider: str,
        provider_id: str,
    ) -> dict:
        row = await self.pool.fetchrow(
            UPSERT_USER_SQL,
            email,
            display_name,
            handle,
            avatar_url,
            provider,
            provider_id,
        )
        return dict(row)

    async def get_user_by_email(self, email: str) -> dict | None:
        row = await self.pool.fetchrow(GET_USER_BY_EMAIL_SQL, email)
        return dict(row) if row else None

    async def get_user_by_id(self, user_id: str) -> dict | None:
        import uuid
        row = await self.pool.fetchrow(GET_USER_BY_ID_SQL, uuid.UUID(user_id))
        return dict(row) if row else None

    async def get_user_settings(self, user_id: str) -> dict | None:
        import uuid
        row = await self.pool.fetchrow(GET_USER_SETTINGS_SQL, uuid.UUID(user_id))
        return dict(row) if row else None

    async def upsert_user_settings(self, *, user_id: str, settings_payload: dict[str, Any]) -> dict:
        import json, uuid
        row = await self.pool.fetchrow(
            UPSERT_USER_SETTINGS_SQL,
            uuid.UUID(user_id),
            json.dumps(settings_payload or {}),
        )
        return dict(row) if row else {"settings": settings_payload or {}, "updated_at": None}

    async def list_users(self, limit: int = 50, offset: int = 0) -> list[dict]:
        rows = await self.pool.fetch(LIST_USERS_SQL, limit, offset)
        return [dict(row) for row in rows]

    async def count_users(self) -> int:
        return int(await self.pool.fetchval(COUNT_USERS_SQL))

    # ── Sessions ───────────────────────────────────────────────────────────
    async def create_session(
        self,
        *,
        user_id: str,
        session_token: str,
        ip_address: str,
        user_agent: str,
        device_type: str = "unknown",
        country_code: str = "",
    ) -> dict:
        import uuid
        row = await self.pool.fetchrow(
            CREATE_SESSION_SQL,
            uuid.UUID(user_id),
            session_token,
            ip_address,
            user_agent,
            device_type,
            country_code,
        )
        return dict(row)

    async def get_session(self, session_token: str) -> dict | None:
        row = await self.pool.fetchrow(GET_SESSION_SQL, session_token)
        return dict(row) if row else None

    async def touch_session(self, session_token: str) -> None:
        await self.pool.execute(TOUCH_SESSION_SQL, session_token)

    async def invalidate_session(self, session_token: str) -> None:
        await self.pool.execute(INVALIDATE_SESSION_SQL, session_token)

    # ── Login events ─────────────────────────────────────────────────────────
    async def record_login_event(
        self,
        *,
        user_id: str | None,
        email: str,
        provider: str,
        success: bool,
        ip_address: str,
        user_agent: str,
        failure_reason: str = "",
    ) -> None:
        import uuid
        uid = uuid.UUID(user_id) if user_id else None
        await self.pool.execute(
            INSERT_LOGIN_EVENT_SQL,
            uid,
            email,
            provider,
            success,
            ip_address,
            user_agent,
            failure_reason or None,
        )

    # ── Analytics events ──────────────────────────────────────────────────────
    async def record_search_event(
        self,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        anonymous_id: str = "",
        query_raw: str,
        query_normalized: str,
        result_count: int = 0,
        response_ms: int | None = None,
        ip_address: str = "",
        user_agent: str = "",
        region: str = "",
        display_language: str = "en-US",
        safe_search: str = "moderate",
        has_attachment: bool = False,
        search_tab: str = "all",
    ) -> str:
        import uuid
        uid = uuid.UUID(user_id) if user_id else None
        sid = uuid.UUID(session_id) if session_id else None
        row = await self.pool.fetchrow(
            INSERT_SEARCH_EVENT_SQL,
            uid,
            sid,
            anonymous_id,
            query_raw,
            query_normalized,
            result_count,
            response_ms,
            ip_address,
            user_agent,
            region,
            display_language,
            safe_search,
            has_attachment,
            search_tab,
        )
        return str(row["id"])

    async def record_click_event(
        self,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        anonymous_id: str = "",
        search_event_id: str | None = None,
        result_url: str,
        result_title: str = "",
        result_domain: str = "",
        result_rank: int | None = None,
        query_raw: str = "",
        ip_address: str = "",
        user_agent: str = "",
        referrer_url: str = "",
    ) -> None:
        import uuid
        uid = uuid.UUID(user_id) if user_id else None
        sid = uuid.UUID(session_id) if session_id else None
        eid = uuid.UUID(search_event_id) if search_event_id else None
        await self.pool.execute(
            INSERT_CLICK_EVENT_SQL,
            uid,
            sid,
            anonymous_id,
            eid,
            result_url,
            result_title,
            result_domain,
            result_rank,
            query_raw,
            ip_address,
            user_agent,
            referrer_url or None,
        )

    async def record_impression_event(
        self,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        anonymous_id: str = "",
        search_event_id: str | None = None,
        event_type: str,
        payload: dict | None = None,
    ) -> None:
        import json, uuid
        uid = uuid.UUID(user_id) if user_id else None
        sid = uuid.UUID(session_id) if session_id else None
        eid = uuid.UUID(search_event_id) if search_event_id else None
        await self.pool.execute(
            INSERT_IMPRESSION_EVENT_SQL,
            uid,
            sid,
            anonymous_id,
            eid,
            event_type,
            json.dumps(payload or {}),
        )

    async def get_user_search_history(self, user_id: str, limit: int = 50) -> list[dict]:
        import uuid
        rows = await self.pool.fetch(USER_SEARCH_HISTORY_SQL, uuid.UUID(user_id), limit)
        return [dict(row) for row in rows]

    async def get_user_click_history(self, user_id: str, limit: int = 50) -> list[dict]:
        import uuid
        rows = await self.pool.fetch(USER_CLICK_HISTORY_SQL, uuid.UUID(user_id), limit)
        return [dict(row) for row in rows]

    async def list_admin_user_activity(self, limit: int = 50, offset: int = 0) -> list[dict]:
        rows = await self.pool.fetch(ADMIN_USER_ACTIVITY_SQL, limit, offset)
        return [dict(row) for row in rows]

    async def count_admin_user_activity(self) -> int:
        return int(await self.pool.fetchval(COUNT_ADMIN_USER_ACTIVITY_SQL))

    async def get_admin_user_activity_report(self, sample_limit: int = 20) -> dict[str, Any]:
        summary_row = await self.pool.fetchrow(ADMIN_USER_ACTIVITY_REPORT_SQL)
        sample_rows = await self.pool.fetch(ADMIN_USER_ACTIVITY_VIEW_SAMPLE_SQL, sample_limit)
        return {
            "summary": dict(summary_row) if summary_row else {},
            "sample_rows": [dict(row) for row in sample_rows],
        }


class DisabledPostgresStorage(PostgresStorage):
    def __init__(self, database_url: str, error: Exception | None = None) -> None:
        super().__init__(database_url)
        self._error = error

    async def connect(self) -> None:
        return None

    @property
    def is_available(self) -> bool:
        return False

    async def healthcheck(self) -> bool:
        return False

    async def count_pages(self) -> int:
        return 0

    async def search_pages(
        self,
        query: str,
        limit: int = 10,
        *,
        site: str = "",
        filetype: str = "",
        date_range: str = "",
    ) -> list[SearchRecord]:
        return []

    async def latest_pages(self, limit: int = 10) -> list[SearchRecord]:
        return []

    async def get_pagerank_scores(self, urls: list[str]) -> dict[str, float]:
        return {}

    async def compute_all_pagerank_scores(self) -> dict[str, float]:
        return {}

    async def upsert_page(
        self,
        *,
        url: str,
        title: str,
        body: str,
        summary: str,
        outbound_links: list[str],
        last_seed_query: str = "",
    ) -> None:
        return None

    async def fetch_page_documents(self, limit: int = 500) -> list[dict[str, Any]]:
        return []

    async def list_users(self, limit: int = 50, offset: int = 0) -> list[dict]:
        return []

    async def count_users(self) -> int:
        return 0

    async def get_user_search_history(self, user_id: str, limit: int = 50) -> list[dict]:
        return []

    async def get_user_click_history(self, user_id: str, limit: int = 50) -> list[dict]:
        return []

    async def list_admin_user_activity(self, limit: int = 50, offset: int = 0) -> list[dict]:
        return []

    async def count_admin_user_activity(self) -> int:
        return 0

    async def get_admin_user_activity_report(self, sample_limit: int = 20) -> dict[str, Any]:
        return {"summary": {}, "sample_rows": []}

    async def upsert_oauth_user(
        self,
        *,
        email: str,
        display_name: str,
        handle: str,
        avatar_url: str,
        provider: str,
        provider_id: str,
    ) -> dict:
        return {"id": "00000000-0000-0000-0000-000000000000", "is_admin": False}

    async def get_user_by_email(self, email: str) -> dict | None:
        return None

    async def get_user_by_id(self, user_id: str) -> dict | None:
        return None

    async def get_user_settings(self, user_id: str) -> dict | None:
        return None

    async def upsert_user_settings(self, *, user_id: str, settings_payload: dict[str, Any]) -> dict:
        return {"settings": settings_payload or {}, "updated_at": None}

    async def create_session(
        self,
        *,
        user_id: str,
        session_token: str,
        ip_address: str,
        user_agent: str,
        device_type: str = "unknown",
        country_code: str = "",
    ) -> dict:
        return {
            "id": "00000000-0000-0000-0000-000000000000",
            "user_id": user_id,
            "session_token": session_token,
        }

    async def get_session(self, session_token: str) -> dict | None:
        return None

    async def touch_session(self, session_token: str) -> None:
        return None

    async def invalidate_session(self, session_token: str) -> None:
        return None

    async def record_login_event(
        self,
        *,
        user_id: str | None,
        email: str,
        provider: str,
        success: bool,
        ip_address: str,
        user_agent: str,
        failure_reason: str = "",
    ) -> None:
        return None

    async def record_search_event(
        self,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        anonymous_id: str = "",
        query_raw: str,
        query_normalized: str,
        result_count: int = 0,
        response_ms: int | None = None,
        ip_address: str = "",
        user_agent: str = "",
        region: str = "",
        display_language: str = "en-US",
        safe_search: str = "moderate",
        has_attachment: bool = False,
        search_tab: str = "all",
    ) -> str:
        return ""

    async def record_click_event(
        self,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        anonymous_id: str = "",
        search_event_id: str | None = None,
        result_url: str,
        result_title: str = "",
        result_domain: str = "",
        result_rank: int | None = None,
        query_raw: str = "",
        ip_address: str = "",
        user_agent: str = "",
        referrer_url: str = "",
    ) -> None:
        return None

    async def record_impression_event(
        self,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        anonymous_id: str = "",
        search_event_id: str | None = None,
        event_type: str,
        payload: dict | None = None,
    ) -> None:
        return None
