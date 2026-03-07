import type { DatabaseSync } from 'node:sqlite';

export function initializeSchema(database: DatabaseSync) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_mtime_ms INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      last_updated_at TEXT NOT NULL,
      cwd TEXT,
      cli_version TEXT,
      event_count INTEGER NOT NULL,
      has_errors INTEGER NOT NULL,
      title TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS timeline_items (
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      timestamp TEXT,
      kind TEXT NOT NULL,
      role TEXT,
      title TEXT NOT NULL,
      text_content TEXT,
      raw_payload TEXT NOT NULL,
      PRIMARY KEY (session_id, seq),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE IF NOT EXISTS diagnostics (
      id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER,
      severity TEXT NOT NULL,
      message TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS tracked_files (
      file_path TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      file_mtime_ms INTEGER NOT NULL,
      file_size INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      session_id UNINDEXED,
      timeline_seq UNINDEXED,
      matched_field UNINDEXED,
      content
    );
  `);
}
