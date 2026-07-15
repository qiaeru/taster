-- SPDX-License-Identifier: MIT
-- Initial schema.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  session_epoch INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, name)
);
CREATE INDEX idx_statuses_category ON statuses(category_id);

CREATE TABLE tastes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  status_id INTEGER REFERENCES statuses(id) ON DELETE SET NULL,
  -- Base filename under DATA_DIR/uploads (display variant), never a path.
  image_file TEXT,
  -- 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'; precision derives from length and
  -- lexicographic order matches chronological order.
  ref_date TEXT,
  lat REAL,
  lng REAL,
  external_review_url TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tastes_category ON tastes(category_id);
CREATE INDEX idx_tastes_published ON tastes(published);
CREATE INDEX idx_tastes_created ON tastes(created_at DESC);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taste_id TEXT NOT NULL REFERENCES tastes(id) ON DELETE CASCADE,
  subtitle TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  body_md TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sections_taste ON sections(taste_id);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE taste_tags (
  taste_id TEXT NOT NULL REFERENCES tastes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (taste_id, tag_id)
);
CREATE INDEX idx_taste_tags_tag ON taste_tags(tag_id);

CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taste_id TEXT NOT NULL REFERENCES tastes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_links_taste ON links(taste_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
