import { randomUUID } from "crypto";
import { DatabaseConnection } from "../db";
import { ChunkStatus, MediaChunk, StreamType } from "../models";

const mapRow = (row: any): MediaChunk => ({
  id: row.id,
  sessionId: row.session_id,
  streamType: row.stream_type,
  chunkIndex: row.chunk_index,
  status: row.status,
  checksum: row.checksum,
  byteSize: row.byte_size,
  storageKey: row.storage_key,
  uploadUrl: row.upload_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class MediaChunkRepository {
  constructor(private readonly db: DatabaseConnection) {}

  create(entry: {
    sessionId: string;
    streamType: StreamType;
    chunkIndex: number;
    status: ChunkStatus;
    storageKey: string;
    uploadUrl: string;
  }): MediaChunk {
    const now = new Date().toISOString();
    const id = randomUUID();
    const stmt = this.db.prepare(
      `INSERT INTO media_chunks(id, session_id, stream_type, chunk_index, status, storage_key, upload_url, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(id, entry.sessionId, entry.streamType, entry.chunkIndex, entry.status, entry.storageKey, entry.uploadUrl, now, now);
    return this.findById(id)!;
  }

  findById(id: string): MediaChunk | null {
    const stmt = this.db.prepare(`SELECT * FROM media_chunks WHERE id = ?`);
    const row = stmt.get(id);
    return row ? mapRow(row) : null;
  }

  findBySession(sessionId: string): MediaChunk[] {
    const stmt = this.db.prepare(`SELECT * FROM media_chunks WHERE session_id = ? ORDER BY stream_type, chunk_index`);
    const rows = stmt.all(sessionId);
    return rows.map(mapRow);
  }

  findBySessionAndStream(sessionId: string, streamType: StreamType): MediaChunk[] {
    const stmt = this.db.prepare(
      `SELECT * FROM media_chunks WHERE session_id = ? AND stream_type = ? ORDER BY chunk_index`
    );
    const rows = stmt.all(sessionId, streamType);
    return rows.map(mapRow);
  }

  updateMetadata(id: string, metadata: Partial<Pick<MediaChunk, "status" | "checksum" | "byteSize" | "storageKey" | "uploadUrl">>): MediaChunk {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE media_chunks SET status = COALESCE(?, status), checksum = COALESCE(?, checksum), byte_size = COALESCE(?, byte_size), storage_key = COALESCE(?, storage_key), upload_url = COALESCE(?, upload_url), updated_at = ? WHERE id = ?`
    );
    stmt.run(
      metadata.status ?? null,
      metadata.checksum ?? null,
      metadata.byteSize ?? null,
      metadata.storageKey ?? null,
      metadata.uploadUrl ?? null,
      now,
      id
    );
    return this.findById(id)!;
  }

  deleteBySession(sessionId: string): void {
    const stmt = this.db.prepare(`DELETE FROM media_chunks WHERE session_id = ?`);
    stmt.run(sessionId);
  }
}
