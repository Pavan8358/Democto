import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export type DatabaseConnection = Database.Database;

export interface DatabaseOptions {
  filename?: string;
}

const DEFAULT_DB_FILE = path.resolve(process.cwd(), "var/data/exam-media.db");

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS exam_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  include_screen INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  total_duration_ms INTEGER,
  manifest_url TEXT,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS media_chunks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  stream_type TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  checksum TEXT,
  byte_size INTEGER,
  storage_key TEXT,
  upload_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_chunks_session_stream_chunk ON media_chunks(session_id, stream_type, chunk_index);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  stream_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recording_chunks (
  id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(recording_id) REFERENCES recordings(id) ON DELETE CASCADE,
  FOREIGN KEY(chunk_id) REFERENCES media_chunks(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recording_chunks_recording_position ON recording_chunks(recording_id, position);
`;

export const createDatabase = (options: DatabaseOptions = {}): DatabaseConnection => {
  const filename = options.filename ?? DEFAULT_DB_FILE;
  if (filename !== ":memory:" && filename !== "" && filename !== undefined) {
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(MIGRATIONS);
  return db;
};
