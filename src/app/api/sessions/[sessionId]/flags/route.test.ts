import { beforeEach, describe, expect, it } from "vitest";

import { flagStore } from "@/lib/store/flag-store";
import { GET, POST } from "./route";

describe("/api/sessions/[sessionId]/flags", () => {
  beforeEach(() => {
    flagStore.reset();
  });

  it("persists flag events and exposes them via GET", async () => {
    const sessionId = "session-test";
    const payload = {
      type: "FACE_MISSING",
      severity: "warning",
      relativeMs: 1200,
      metadata: {
        framesWithoutFace: 18,
      },
    };

    const request = new Request("http://localhost/api/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: { sessionId } });
    expect(response.status).toBe(201);

    const stored = await response.json();
    expect(stored.type).toBe("FACE_MISSING");
    expect(stored.sessionId).toBe(sessionId);
    expect(stored.metadata).toEqual(payload.metadata);

    const getResponse = await GET(new Request("http://localhost/api/sessions", { method: "GET" }), {
      params: { sessionId },
    });
    expect(getResponse.status).toBe(200);

    const json = await getResponse.json();
    expect(json.session.events).toHaveLength(1);
    expect(json.session.events[0].id).toBe(stored.id);
  });

  it("validates payload shape", async () => {
    const sessionId = "session-invalid";
    const request = new Request("http://localhost/api/sessions", {
      method: "POST",
      body: JSON.stringify({ type: "FACE_MISSING" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, { params: { sessionId } });
    expect(response.status).toBe(400);

    const getResponse = await GET(new Request("http://localhost/api/sessions", { method: "GET" }), {
      params: { sessionId },
    });
    const json = await getResponse.json();
    expect(json.session.events).toHaveLength(0);
  });
});
