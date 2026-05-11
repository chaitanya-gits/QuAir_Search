CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    handle TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'google',
    provider_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_provider_provider_id_idx
    ON users (provider, provider_id)
    WHERE provider_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    device_type TEXT NOT NULL DEFAULT 'unknown',
    country_code TEXT NOT NULL DEFAULT '',
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    success BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    failure_reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    anonymous_id TEXT NOT NULL DEFAULT '',
    query_raw TEXT NOT NULL,
    query_normalized TEXT NOT NULL DEFAULT '',
    result_count INTEGER NOT NULL DEFAULT 0,
    response_ms INTEGER,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    display_language TEXT NOT NULL DEFAULT 'en-US',
    safe_search TEXT NOT NULL DEFAULT 'moderate',
    has_attachment BOOLEAN NOT NULL DEFAULT FALSE,
    search_tab TEXT NOT NULL DEFAULT 'all',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_events_user_id_idx ON search_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS search_events_session_id_idx ON search_events (session_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS click_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    anonymous_id TEXT NOT NULL DEFAULT '',
    search_event_id UUID REFERENCES search_events(id) ON DELETE SET NULL,
    result_url TEXT NOT NULL,
    result_title TEXT NOT NULL DEFAULT '',
    result_domain TEXT NOT NULL DEFAULT '',
    result_rank INTEGER,
    query_raw TEXT NOT NULL DEFAULT '',
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    referrer_url TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS click_events_user_id_idx ON click_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS click_events_search_event_id_idx ON click_events (search_event_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS impression_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    anonymous_id TEXT NOT NULL DEFAULT '',
    search_event_id UUID REFERENCES search_events(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW admin_user_activity_view AS
SELECT
    u.id AS user_id,
    u.display_name,
    u.email,
    u.provider,
    u.is_admin,
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
) ce ON TRUE;
