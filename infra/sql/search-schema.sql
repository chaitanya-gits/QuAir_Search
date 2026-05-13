CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS pages (
  url TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  summary TEXT NOT NULL,
  last_seed_query TEXT NOT NULL DEFAULT '',
  outbound_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_document TSVECTOR NOT NULL DEFAULT ''::tsvector
);

CREATE INDEX IF NOT EXISTS pages_updated_at_idx ON pages (updated_at DESC);
CREATE INDEX IF NOT EXISTS pages_search_document_idx ON pages USING GIN (search_document);

CREATE TABLE IF NOT EXISTS page_embeddings (
  url TEXT PRIMARY KEY REFERENCES pages(url) ON DELETE CASCADE,
  embedding VECTOR(1536) NOT NULL,
  model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS page_embeddings_vector_idx
  ON page_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS page_links (
  source_url TEXT NOT NULL REFERENCES pages(url) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_url, target_url)
);

CREATE INDEX IF NOT EXISTS page_links_target_idx ON page_links (target_url);
