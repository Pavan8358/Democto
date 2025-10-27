import { describe, expect, it, vi } from "vitest";

import { FlagDispatcher } from "./flag-dispatcher";
import type { FlagEvent, FlagEventInput } from "@/lib/types/flags";

const createEvent = (sessionId: string, payload: FlagEventInput, timestamp: number): FlagEvent => ({
  id: `${payload.type}-${timestamp}`,
  sessionId,
  occurredAt: new Date(timestamp).toISOString(),
  type: payload.type,
  severity: payload.severity,
  relativeMs: payload.relativeMs ?? timestamp,
  metadata: payload.metadata ?? {},
});

describe("FlagDispatcher", () => {
  it("debounces duplicate flag types within the configured window", async () => {
    let now = 0;
    const postFlag = vi
      .fn()
      .mockImplementation(async (payload) => createEvent("alpha", payload, now));

    const dispatcher = new FlagDispatcher({
      sessionId: "alpha",
      sessionStartMs: 0,
      debounceWindowMs: 1000,
      postFlag,
      nowProvider: () => now,
    });

    await dispatcher.emit({ type: "FACE_MISSING", severity: "warning" });
    expect(postFlag).toHaveBeenCalledTimes(1);

    now = 400;
    await dispatcher.emit({ type: "FACE_MISSING", severity: "warning" });
    expect(postFlag).toHaveBeenCalledTimes(1);

    now = 1400;
    await dispatcher.emit({ type: "FACE_MISSING", severity: "warning" });
    expect(postFlag).toHaveBeenCalledTimes(2);
  });

  it("calculates relativeMs from the session start when omitted", async () => {
    const now = 1500;
    const postFlag = vi
      .fn()
      .mockImplementation(async (payload) => createEvent("beta", payload, now));

    const dispatcher = new FlagDispatcher({
      sessionId: "beta",
      sessionStartMs: 500,
      debounceWindowMs: 1000,
      postFlag,
      nowProvider: () => now,
    });

    await dispatcher.emit({ type: "TAB_SWITCH", severity: "warning" });

    expect(postFlag).toHaveBeenCalledTimes(1);
    expect(postFlag.mock.calls[0][0].relativeMs).toBe(1000);
  });

  it("allows retries when posting fails", async () => {
    let now = 0;
    const postFlag = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementation(async (payload) => createEvent("gamma", payload, now));

    const dispatcher = new FlagDispatcher({
      sessionId: "gamma",
      sessionStartMs: 0,
      debounceWindowMs: 1000,
      postFlag,
      nowProvider: () => now,
    });

    const first = await dispatcher.emit({ type: "SPEAKING", severity: "warning" });
    expect(first).toBeNull();
    expect(postFlag).toHaveBeenCalledTimes(1);

    now = 200;
    const second = await dispatcher.emit({ type: "SPEAKING", severity: "warning" });
    expect(postFlag).toHaveBeenCalledTimes(2);
    expect(second).not.toBeNull();
  });
});
