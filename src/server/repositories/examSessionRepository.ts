import { DatabaseConnection } from "../db";
import { ExamSession, SessionStatus } from "../models";

const mapRow = (row: any): ExamSession => ({
  id: row.id,
  ownerId: row.owner_id,
  includeScreen: !!row.include_screen,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  totalDurationMs: row.total_duration_ms,
  manifestUrl: row.manifest_url,
  failureReason: row.failure_reason
});

export class ExamSessionRepository {
  constructor(private readonly db: DatabaseConnection) {}

  findById(id: string): ExamSession | null {
    const stmt = this.db.prepare(
      `SELECT * FROM exam_sessions WHERE id = ?`
    );
    const row = stmt.get(id);
    return row ? mapRow(row) : null;
  }

  upsert(session: {
    id: string;
    ownerId: string;
    includeScreen: boolean;
    status: SessionStatus;
    startedAt?: string | null;
  }): ExamSession {
    const now = new Date().toISOString();
    const existing = this.findById(session.id);

    if (existing) {
      const stmt = this.db.prepare(
        `UPDATE exam_sessions SET status = ?, include_screen = ?, updated_at = ?, started_at = COALESCE(started_at, ?)
         WHERE id = ?`
      );
      stmt.run(session.status, session.includeScreen ? 1 : 0, now, session.startedAt ?? now, session.id);
      return this.findById(session.id)!;
    }

    const insert = this.db.prepare(
      `INSERT INTO exam_sessions(id, owner_id, include_screen, status, created_at, updated_at, started_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`
    );
    insert.run(
      session.id,
      session.ownerId,
      session.includeScreen ? 1 : 0,
      session.status,
      now,
      now,
      session.startedAt ?? now
    );
    return this.findById(session.id)!;
  }

  updateStatus(id: string, status: SessionStatus, extra: Partial<Pick<ExamSession, "endedAt" | "totalDurationMs" | "manifestUrl" | "failureReason">> = {}): ExamSession {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE exam_sessions SET status = ?, updated_at = ?, ended_at = COALESCE(?, ended_at), total_duration_ms = COALESCE(?, total_duration_ms), manifest_url = COALESCE(?, manifest_url), failure_reason = COALESCE(?, failure_reason)
       WHERE id = ?`
    );
    stmt.run(
      status,
      now,
      extra.endedAt ?? null,
      extra.totalDurationMs ?? null,
      extra.manifestUrl ?? null,
      extra.failureReason ?? null,
      id
    );
    return this.findById(id)!;
  }
}
