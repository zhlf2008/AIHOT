-- D1-only schema. This directory is intentionally outside the PostgreSQL module migration scan.
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  published_at TEXT,
  collected_at TEXT NOT NULL,
  relevance INTEGER NOT NULL DEFAULT 0,
  date_kind TEXT NOT NULL DEFAULT 'published'
);
CREATE INDEX IF NOT EXISTS articles_date ON articles(published_at DESC, collected_at DESC);
CREATE INDEX IF NOT EXISTS articles_category ON articles(category, published_at DESC);
CREATE TABLE IF NOT EXISTS source_runs (
  source_id TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL,
  discovered INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE TABLE IF NOT EXISTS collection_lock (
  id INTEGER PRIMARY KEY CHECK(id=1),
  expires_at INTEGER NOT NULL
);
