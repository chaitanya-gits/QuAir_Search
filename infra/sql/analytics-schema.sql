CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  display_name  TEXT,
  handle        TEXT,
  avatar_url    TEXT,
  provider      TEXT NOT NULL DEFAULT 'email',
  provider_id   TEXT,
  password_hash TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_provider_id_idx
  ON users (provider, provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address    TEXT,
  user_agent    TEXT,
  device_type   TEXT,
  os_family     TEXT,
  browser_family TEXT,
  country_code  TEXT,
  city          TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_token_idx   ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS login_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  email         TEXT,
  provider      TEXT NOT NULL,
  success       BOOLEAN NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  failure_reason TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_events_user_id_idx    ON login_events (user_id);
CREATE INDEX IF NOT EXISTS login_events_occurred_at_idx ON login_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS search_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id       UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  anonymous_id     TEXT,
  query_raw        TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  result_count     INTEGER NOT NULL DEFAULT 0,
  response_ms      INTEGER,
  ip_address       TEXT,
  user_agent       TEXT,
  region           TEXT,
  display_language TEXT,
  safe_search      TEXT,
  has_attachment   BOOLEAN NOT NULL DEFAULT FALSE,
  search_tab       TEXT NOT NULL DEFAULT 'all',
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_events_user_id_idx     ON search_events (user_id);
CREATE INDEX IF NOT EXISTS search_events_session_id_idx  ON search_events (session_id);
CREATE INDEX IF NOT EXISTS search_events_occurred_at_idx ON search_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS search_events_query_idx
  ON search_events USING GIN (to_tsvector('english', query_normalized));

CREATE TABLE IF NOT EXISTS click_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  anonymous_id    TEXT,
  search_event_id UUID REFERENCES search_events(id) ON DELETE SET NULL,
  result_url      TEXT NOT NULL,
  result_title    TEXT,
  result_domain   TEXT,
  result_rank     INTEGER,
  query_raw       TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  referrer_url    TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS click_events_user_id_idx      ON click_events (user_id);
CREATE INDEX IF NOT EXISTS click_events_session_id_idx   ON click_events (session_id);
CREATE INDEX IF NOT EXISTS click_events_result_url_idx   ON click_events (result_url);
CREATE INDEX IF NOT EXISTS click_events_occurred_at_idx  ON click_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS impression_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  anonymous_id    TEXT,
  search_event_id UUID REFERENCES search_events(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS impression_events_user_id_idx     ON impression_events (user_id);
CREATE INDEX IF NOT EXISTS impression_events_occurred_at_idx ON impression_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS impression_events_type_idx        ON impression_events (event_type);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_search_stats AS
SELECT
  DATE_TRUNC('day', occurred_at) AS day,
  COUNT(*)                        AS total_searches,
  COUNT(DISTINCT user_id)         AS unique_users,
  COUNT(DISTINCT anonymous_id)    AS anonymous_users,
  AVG(response_ms)                AS avg_response_ms,
  SUM(result_count)               AS total_results_served
FROM search_events
GROUP BY DATE_TRUNC('day', occurred_at)
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_search_stats_day_idx
  ON mv_daily_search_stats (day);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_queries AS
SELECT
  query_normalized,
  COUNT(*) AS search_count,
  COUNT(DISTINCT user_id) AS unique_users,
  MAX(occurred_at) AS last_searched_at
FROM search_events
GROUP BY query_normalized
ORDER BY search_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_top_queries_query_idx
  ON mv_top_queries (query_normalized);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_clicked_urls AS
SELECT
  result_url,
  result_title,
  result_domain,
  COUNT(*) AS click_count,
  COUNT(DISTINCT user_id) AS unique_users,
  AVG(result_rank) AS avg_rank_when_clicked
FROM click_events
GROUP BY result_url, result_title, result_domain
ORDER BY click_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_top_clicked_urls_url_idx
  ON mv_top_clicked_urls (result_url);
