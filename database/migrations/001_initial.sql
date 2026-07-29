PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  media_type TEXT NOT NULL,
  release_year INTEGER,
  rights_status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS known_characters (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rights_status TEXT NOT NULL CHECK (rights_status = 'reference_only'),
  risk_level TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_relationships (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  from_character_id TEXT NOT NULL REFERENCES known_characters(id) ON DELETE CASCADE,
  to_character_id TEXT NOT NULL REFERENCES known_characters(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  CHECK (from_character_id <> to_character_id)
);

CREATE TABLE IF NOT EXISTS iconic_moments (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rights_status TEXT NOT NULL CHECK (rights_status = 'reference_only'),
  risk_level TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trends (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  heat REAL,
  velocity REAL,
  lifecycle TEXT NOT NULL,
  rights_status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS trends_category_last_seen_idx
  ON trends(category, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS trend_sources (
  trend_id TEXT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  page_title TEXT NOT NULL,
  published_at TEXT,
  collected_at TEXT NOT NULL,
  PRIMARY KEY (trend_id, url)
);

CREATE TABLE IF NOT EXISTS trend_metrics (
  trend_id TEXT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  PRIMARY KEY (trend_id, name, value, unit, observed_at)
);

CREATE TABLE IF NOT EXISTS trend_batches (
  trend_id TEXT NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL,
  PRIMARY KEY (trend_id, batch_id)
);

CREATE TABLE IF NOT EXISTS collection_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  status TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  item_count INTEGER NOT NULL,
  error_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_items (
  run_id TEXT NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (run_id, item_id)
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  source_trend_id TEXT NOT NULL,
  status TEXT NOT NULL,
  total_score REAL NOT NULL,
  payload_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);
