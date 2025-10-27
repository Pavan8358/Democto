import { randomUUID } from "node:crypto";

import type { FlagEvent, FlagEventInput, SessionFlagLog } from "@/lib/types/flags";

class InMemoryFlagStore {
  private sessions = new Map<string, { startedAt: number; events: FlagEvent[] }>();

  addEvent(sessionId: string, input: FlagEventInput): FlagEvent {
    const now = Date.now();
    const session = this.ensureSession(sessionId, now);

    const event: FlagEvent = {
      id: randomUUID(),
      sessionId,
      occurredAt: new Date(now).toISOString(),
      type: input.type,
      severity: input.severity,
      relativeMs: input.relativeMs,
      metadata: input.metadata ?? {},
    };

    session.events.push(event);
    return event;
  }

  getEvents(sessionId: string): FlagEvent[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return [...session.events];
  }

  getSession(sessionId: string): SessionFlagLog | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId,
      startedAt: new Date(session.startedAt).toISOString(),
      events: [...session.events],
    };
  }

  reset(): void {
    this.sessions.clear();
  }

  private ensureSession(sessionId: string, startedAt: number) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        startedAt,
        events: [],
      });
    }

    return this.sessions.get(sessionId)!;
  }
}

export const flagStore = new InMemoryFlagStore();
export type FlagStore = InMemoryFlagStore;
