import { flagDebounceWindowMs } from "@/lib/config/detection";
import type { FlagEvent, FlagEventInput, FlagMetadata, FlagType } from "@/lib/types/flags";

export interface DispatcherOptions {
  sessionId: string;
  sessionStartMs: number;
  debounceWindowMs?: number;
  postFlag?: (payload: FlagEventInput) => Promise<FlagEvent>;
  onEmit?: (event: FlagEvent) => void;
  nowProvider?: () => number;
}

export interface DispatchPayload extends Omit<FlagEventInput, "relativeMs" | "metadata"> {
  relativeMs?: number;
  metadata?: FlagMetadata;
}

export class FlagDispatcher {
  private readonly sessionId: string;
  private readonly sessionStartMs: number;
  private readonly debounceWindowMs: number;
  private readonly postFlag?: (payload: FlagEventInput) => Promise<FlagEvent>;
  private readonly onEmit?: (event: FlagEvent) => void;
  private readonly nowProvider?: () => number;
  private disposed = false;
  private lastEmitted = new Map<FlagType, number>();

  constructor(options: DispatcherOptions) {
    this.sessionId = options.sessionId;
    this.sessionStartMs = options.sessionStartMs;
    this.debounceWindowMs = options.debounceWindowMs ?? flagDebounceWindowMs;
    this.postFlag = options.postFlag;
    this.onEmit = options.onEmit;
    this.nowProvider = options.nowProvider;
  }

  dispose() {
    this.disposed = true;
    this.lastEmitted.clear();
  }

  async emit(payload: DispatchPayload): Promise<FlagEvent | null> {
    if (this.disposed) {
      return null;
    }

    const now = this.now();
    const last = this.lastEmitted.get(payload.type);
    if (last !== undefined && now - last < this.debounceWindowMs) {
      return null;
    }

    this.lastEmitted.set(payload.type, now);

    const body: FlagEventInput = {
      type: payload.type,
      severity: payload.severity,
      relativeMs: payload.relativeMs ?? Math.max(0, now - this.sessionStartMs),
      metadata: payload.metadata ?? {},
    };

    try {
      const event = await this.post(body);
      this.onEmit?.(event);
      return event;
    } catch (error) {
      // Restore the previous timestamp so a retry can occur if the dispatch fails.
      if (last === undefined) {
        this.lastEmitted.delete(payload.type);
      } else {
        this.lastEmitted.set(payload.type, last);
      }
      console.error(`[FlagDispatcher] Failed to dispatch ${payload.type}`, error);
      return null;
    }
  }

  private async post(payload: FlagEventInput): Promise<FlagEvent> {
    if (this.postFlag) {
      return this.postFlag(payload);
    }

    const response = await fetch(`/api/sessions/${encodeURIComponent(this.sessionId)}/flags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to persist flag event: ${response.status}`);
    }

    return (await response.json()) as FlagEvent;
  }

  private now(): number {
    return this.nowProvider?.() ?? Date.now();
  }
}
