-- Add precomputed PageRank score column to pages table.
-- Scores are updated periodically by the background pagerank_worker
-- instead of being recomputed on every search query.

ALTER TABLE pages ADD COLUMN IF NOT EXISTS pagerank_score FLOAT NOT NULL DEFAULT 0.0;
CREATE INDEX IF NOT EXISTS pages_pagerank_idx ON pages (pagerank_score DESC);
