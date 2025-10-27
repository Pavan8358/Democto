import { ExamSessionRepository } from "../repositories/examSessionRepository";
import { ExamSession } from "../models";

export class ExamSessionService {
  constructor(private readonly repository: ExamSessionRepository) {}

  startSession(params: { sessionId: string; ownerId: string; includeScreen: boolean }): ExamSession {
    return this.repository.upsert({
      id: params.sessionId,
      ownerId: params.ownerId,
      includeScreen: params.includeScreen,
      status: "ACTIVE",
      startedAt: new Date().toISOString()
    });
  }

  ensureOwnership(session: ExamSession | null, ownerId: string, sessionId: string): ExamSession {
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.ownerId !== ownerId) {
      throw new Error(`Forbidden: owner mismatch for session ${sessionId}`);
    }
    return session;
  }

  getSession(sessionId: string): ExamSession | null {
    return this.repository.findById(sessionId);
  }

  markCompleted(sessionId: string, totalDurationMs: number, manifestUrl: string): ExamSession {
    return this.repository.updateStatus(sessionId, "COMPLETED", {
      endedAt: new Date().toISOString(),
      totalDurationMs,
      manifestUrl
    });
  }

  markFailed(sessionId: string, reason?: string): ExamSession {
    return this.repository.updateStatus(sessionId, "FAILED", {
      endedAt: new Date().toISOString(),
      failureReason: reason ?? ""
    });
  }

  markAborted(sessionId: string, reason?: string): ExamSession {
    return this.repository.updateStatus(sessionId, "ABORTED", {
      endedAt: new Date().toISOString(),
      failureReason: reason ?? ""
    });
  }
}
