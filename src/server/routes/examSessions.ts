import express from "express";
import { z } from "zod";
import { ExamSessionService } from "../services/examSessionService";
import { MediaChunkService } from "../services/mediaChunkService";
import { RecordingService } from "../services/recordingService";

const startSessionSchema = z.object({
  includeScreen: z.boolean().default(false)
});

const signSchema = z.object({
  streamType: z.enum(["webcam", "screen"]),
  chunkIndex: z.number().int().min(0),
  byteSize: z.number().int().positive(),
  checksum: z.string().min(32),
  mimeType: z.string().optional()
});

const chunkCompleteSchema = z.object({
  checksum: z.string().min(32),
  byteSize: z.number().int().positive()
});

const finalizeSchema = z.object({
  totalDurationMs: z.number().int().positive(),
  manifestUrl: z.string().optional(),
  streams: z.array(z.object({
    streamType: z.enum(["webcam", "screen"]),
    durationMs: z.number().int().nonnegative(),
    chunks: z.array(z.object({
      chunkId: z.string().uuid(),
      chunkIndex: z.number().int().nonnegative()
    })).nonempty()
  })).nonempty()
});

const abortSchema = z.object({
  reason: z.string().optional()
});

export interface ExamSessionRouterDeps {
  examSessions: ExamSessionService;
  mediaChunks: MediaChunkService;
  recordings: RecordingService;
}

export const createExamSessionRouter = ({ examSessions, mediaChunks, recordings }: ExamSessionRouterDeps) => {
  const router = express.Router({ mergeParams: true });

  router.post("/:sessionId/start", (req, res) => {
    const ownerId = req.header("x-owner-id");
    if (!ownerId) {
      return res.status(400).json({ error: "Missing x-owner-id header" });
    }
    const sessionId = req.params.sessionId;
    try {
      const payload = startSessionSchema.parse(req.body ?? {});
      const session = examSessions.startSession({
        sessionId,
        ownerId,
        includeScreen: payload.includeScreen
      });
      res.json({
        session,
        recording: {
          chunkDurationMs: 10_000,
          maxRetries: 5
        }
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.post("/:sessionId/chunks/sign", async (req, res) => {
    const ownerId = req.header("x-owner-id");
    if (!ownerId) {
      return res.status(400).json({ error: "Missing x-owner-id header" });
    }
    const sessionId = req.params.sessionId;
    try {
      const payload = signSchema.parse(req.body);
      const result = await mediaChunks.requestUploadUrl({
        sessionId,
        ownerId,
        payload: {
          ...payload,
          mimeType: payload.mimeType ?? "video/webm"
        }
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.post("/:sessionId/chunks/:chunkId/complete", (req, res) => {
    const ownerId = req.header("x-owner-id");
    if (!ownerId) {
      return res.status(400).json({ error: "Missing x-owner-id header" });
    }
    const sessionId = req.params.sessionId;
    const chunkId = req.params.chunkId;
    try {
      const payload = chunkCompleteSchema.parse(req.body);
      mediaChunks.markUploaded({
        sessionId,
        ownerId,
        chunkId,
        checksum: payload.checksum,
        byteSize: payload.byteSize
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.post("/:sessionId/finalize", (req, res) => {
    const ownerId = req.header("x-owner-id");
    if (!ownerId) {
      return res.status(400).json({ error: "Missing x-owner-id header" });
    }
    const sessionId = req.params.sessionId;
    try {
      const payload = finalizeSchema.parse(req.body);
      const result = recordings.finalizeRecording(sessionId, ownerId, payload);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.post("/:sessionId/abort", async (req, res) => {
    const ownerId = req.header("x-owner-id");
    if (!ownerId) {
      return res.status(400).json({ error: "Missing x-owner-id header" });
    }
    const sessionId = req.params.sessionId;
    try {
      const payload = abortSchema.parse(req.body ?? {});
      const session = examSessions.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (session.ownerId !== ownerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const deletedKeys = await mediaChunks.deleteChunks(sessionId);
      examSessions.markAborted(sessionId, payload.reason);
      res.json({ ok: true, deletedKeys });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.get("/:sessionId/manifest", (req, res) => {
    const sessionId = req.params.sessionId;
    const manifest = recordings.getManifest(sessionId);
    if (!manifest) {
      return res.status(404).json({ error: "Manifest not found" });
    }
    res.json(manifest);
  });

  return router;
};
