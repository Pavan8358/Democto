import { z } from "zod";
import { MediaChunkRepository } from "../repositories/mediaChunkRepository";
import { RecordingRepository } from "../repositories/recordingRepository";
import { ExamSessionRepository } from "../repositories/examSessionRepository";
import {
  ManifestChunkEntry,
  RecordingManifest,
  RecordingManifestStream,
  Recording
} from "../models";

const finalizeStreamSchema = z.object({
  streamType: z.enum(["webcam", "screen"]),
  durationMs: z.number().int().nonnegative(),
  chunks: z.array(z.object({
    chunkId: z.string().uuid(),
    chunkIndex: z.number().int().nonnegative()
  })).nonempty()
});

const finalizeSchema = z.object({
  totalDurationMs: z.number().int().positive(),
  manifestUrl: z.string().optional(),
  streams: z.array(finalizeStreamSchema).nonempty()
});

export class RecordingService {
  constructor(
    private readonly sessions: ExamSessionRepository,
    private readonly chunks: MediaChunkRepository,
    private readonly recordings: RecordingRepository
  ) {}

  finalizeRecording(sessionId: string, ownerId: string, payload: z.infer<typeof finalizeSchema>): {
    manifest: RecordingManifest;
    recordings: Recording[];
  } {
    const session = this.sessions.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.ownerId !== ownerId) {
      throw new Error("Forbidden");
    }

    const parsed = finalizeSchema.parse(payload);

    const manifestStreams: RecordingManifestStream[] = parsed.streams.map((stream) => {
      const orderedChunks = stream.chunks
        .map((chunk) => {
          const record = this.chunks.findById(chunk.chunkId);
          if (!record) {
            throw new Error(`Chunk ${chunk.chunkId} missing`);
          }
          if (record.sessionId !== sessionId) {
            throw new Error(`Chunk ${chunk.chunkId} does not belong to session ${sessionId}`);
          }
          if (record.status !== "UPLOADED") {
            throw new Error(`Chunk ${chunk.chunkId} is not uploaded`);
          }
          if (record.chunkIndex !== chunk.chunkIndex) {
            throw new Error(`Chunk index mismatch for ${chunk.chunkId}`);
          }
          if (!record.storageKey || !record.checksum || !record.byteSize) {
            throw new Error(`Chunk ${chunk.chunkId} missing metadata`);
          }
          return {
            chunkId: record.id,
            chunkIndex: record.chunkIndex,
            storageKey: record.storageKey,
            checksum: record.checksum,
            byteSize: record.byteSize
          } satisfies ManifestChunkEntry;
        })
        .sort((a, b) => a.chunkIndex - b.chunkIndex);

      return {
        streamType: stream.streamType,
        durationMs: stream.durationMs,
        chunks: orderedChunks
      } satisfies RecordingManifestStream;
    });

    const manifest: RecordingManifest = {
      sessionId,
      createdAt: new Date().toISOString(),
      totalDurationMs: parsed.totalDurationMs,
      streams: manifestStreams
    };

    const manifestJson = JSON.stringify(manifest, null, 2);

    const createdRecordings: Recording[] = manifestStreams.map((stream) => {
      const recording = this.recordings.createRecording({
        sessionId,
        streamType: stream.streamType,
        durationMs: stream.durationMs,
        manifestJson
      });

      stream.chunks.forEach((chunk, index) => {
        this.recordings.createRecordingChunk({
          recordingId: recording.id,
          chunkId: chunk.chunkId,
          position: index
        });
      });
      return recording;
    });

    this.sessions.updateStatus(sessionId, "COMPLETED", {
      endedAt: new Date().toISOString(),
      totalDurationMs: parsed.totalDurationMs,
      manifestUrl: parsed.manifestUrl ?? "local:manifest"
    });

    return { manifest, recordings: createdRecordings };
  }

  getManifest(sessionId: string): RecordingManifest | null {
    const stored = this.recordings.findManifestBySession(sessionId);
    if (!stored) return null;
    return JSON.parse(stored) as RecordingManifest;
  }
}
