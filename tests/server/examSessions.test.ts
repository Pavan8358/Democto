import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import { createApp } from "../../src/server/app";
import { createDatabase } from "../../src/server/db";
import { MockS3Service } from "../../src/server/services/s3Service";

const ownerHeader = { "x-owner-id": "owner-1" };
const checksum = Buffer.alloc(32).toString("base64");

describe("Exam session media recording API", () => {
  const bucketName = "test-bucket";

  const buildApp = () => {
    const db = createDatabase({ filename: ":memory:" });
    const mockS3 = new MockS3Service();
    const { app } = createApp({ database: db, s3Service: mockS3, bucketName });
    return { app, mockS3 };
  };

  beforeEach(() => {
    // ensure any global state is clean if needed
  });

  it("should handle end-to-end recording flow", async () => {
    const { app } = buildApp();
    const sessionId = "session-123";

    const startResponse = await request(app)
      .post(`/api/exam-sessions/${sessionId}/start`)
      .set(ownerHeader)
      .send({ includeScreen: true })
      .expect(200);

    expect(startResponse.body.session.status).toBe("ACTIVE");

    const signResponse = await request(app)
      .post(`/api/exam-sessions/${sessionId}/chunks/sign`)
      .set(ownerHeader)
      .send({
        streamType: "webcam",
        chunkIndex: 0,
        byteSize: 1024,
        checksum,
        mimeType: "video/webm"
      })
      .expect(200);

    expect(signResponse.body.storageKey).toBe(
      `examSessions/${sessionId}/webcam/chunk-0.webm`
    );

    await request(app)
      .post(`/api/exam-sessions/${sessionId}/chunks/${signResponse.body.chunkId}/complete`)
      .set(ownerHeader)
      .send({ checksum, byteSize: 1024 })
      .expect(200);

    const finalizeResponse = await request(app)
      .post(`/api/exam-sessions/${sessionId}/finalize`)
      .set(ownerHeader)
      .send({
        totalDurationMs: 60_000,
        streams: [
          {
            streamType: "webcam",
            durationMs: 60_000,
            chunks: [
              {
                chunkId: signResponse.body.chunkId,
                chunkIndex: 0
              }
            ]
          }
        ]
      })
      .expect(200);

    expect(finalizeResponse.body.recordings).toHaveLength(1);
    expect(finalizeResponse.body.manifest.sessionId).toBe(sessionId);

    const manifestResponse = await request(app)
      .get(`/api/exam-sessions/${sessionId}/manifest`)
      .expect(200);

    expect(manifestResponse.body.streams[0].chunks).toHaveLength(1);
    expect(manifestResponse.body.streams[0].chunks[0].chunkIndex).toBe(0);
  });

  it("should clean up when aborting a recording", async () => {
    const { app, mockS3 } = buildApp();
    const sessionId = "session-abort";

    await request(app)
      .post(`/api/exam-sessions/${sessionId}/start`)
      .set(ownerHeader)
      .send({ includeScreen: false })
      .expect(200);

    const signResponse = await request(app)
      .post(`/api/exam-sessions/${sessionId}/chunks/sign`)
      .set(ownerHeader)
      .send({
        streamType: "webcam",
        chunkIndex: 0,
        byteSize: 2048,
        checksum,
        mimeType: "video/webm"
      })
      .expect(200);

    await request(app)
      .post(`/api/exam-sessions/${sessionId}/abort`)
      .set(ownerHeader)
      .send({ reason: "user exited" })
      .expect(200);

    expect(mockS3.deletedKeys).toContain(`${bucketName}/${signResponse.body.storageKey}`);

    await request(app)
      .get(`/api/exam-sessions/${sessionId}/manifest`)
      .expect(404);
  });

  it("should prevent access from different owners", async () => {
    const { app } = buildApp();
    const sessionId = "session-ownership";

    await request(app)
      .post(`/api/exam-sessions/${sessionId}/start`)
      .set(ownerHeader)
      .send({ includeScreen: false })
      .expect(200);

    await request(app)
      .post(`/api/exam-sessions/${sessionId}/chunks/sign`)
      .set({ "x-owner-id": "another-owner" })
      .send({
        streamType: "webcam",
        chunkIndex: 0,
        byteSize: 1024,
        checksum,
        mimeType: "video/webm"
      })
      .expect(400);
  });
});
