import { randomUUID } from "crypto";
import { DatabaseConnection } from "../db";
import { Recording, RecordingChunk } from "../models";

const mapRecording = (row: any): Recording => ({
  id: row.id,
  sessionId: row.session_id,
  streamType: row.stream_type,
  durationMs: row.duration_ms,
  manifestJson: row.manifest_json,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapRecordingChunk = (row: any): RecordingChunk => ({
  id: row.id,
  recordingId: row.recording_id,
  chunkId: row.chunk_id,
  position: row.position,
  createdAt: row.created_at
});

export class RecordingRepository {
  constructor(private readonly db: DatabaseConnection) {}

  createRecording(entry: {
    sessionId: string;
    streamType: string;
    durationMs: number;
    manifestJson: string;
  }): Recording {
    const now = new Date().toISOString();
    const id = randomUUID();
    const stmt = this.db.prepare(
      `INSERT INTO recordings(id, session_id, stream_type, duration_ms, manifest_json, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(id, entry.sessionId, entry.streamType, entry.durationMs, entry.manifestJson, now, now);
    return this.findById(id)!;
  }

  createRecordingChunk(entry: {
    recordingId: string;
    chunkId: string;
    position: number;
  }): RecordingChunk {
    const now = new Date().toISOString();
    const id = randomUUID();
    const stmt = this.db.prepare(
      `INSERT INTO recording_chunks(id, recording_id, chunk_id, position, created_at)
       VALUES(?, ?, ?, ?, ?)`
    );
    stmt.run(id, entry.recordingId, entry.chunkId, entry.position, now);
    return { id, recordingId: entry.recordingId, chunkId: entry.chunkId, position: entry.position, createdAt: now };
  }

  findBySession(sessionId: string): Recording[] {
    const stmt = this.db.prepare(`SELECT * FROM recordings WHERE session_id = ? ORDER BY created_at`);
    const rows = stmt.all(sessionId);
    return rows.map(mapRecording);
  }

  findById(id: string): Recording | null {
    const stmt = this.db.prepare(`SELECT * FROM recordings WHERE id = ?`);
    const row = stmt.get(id);
    return row ? mapRecording(row) : null;
  }

  findManifestBySession(sessionId: string): string | null {
    const stmt = this.db.prepare(
      `SELECT manifest_json FROM recordings WHERE session_id = ? ORDER BY created_at LIMIT 1`
    );
    const row = stmt.get(sessionId);
    return row?.manifest_json ?? null;
  }
}
