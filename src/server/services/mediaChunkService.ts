import { z } from "zod";
import { MediaChunkRepository } from "../repositories/mediaChunkRepository";
import { ExamSessionRepository } from "../repositories/examSessionRepository";
import { IS3Service } from "./s3Service";
import { ManifestChunkEntry, StreamType } from "../models";
import { RateLimiter } from "../util/rateLimiter";

const signChunkSchema = z.object({
  streamType: z.enum(["webcam", "screen"]),
  chunkIndex: z.number().int().min(0),
  byteSize: z.number().int().positive(),
  checksum: z.string().min(32),
  mimeType: z.string().default("video/webm")
});

export interface SignChunkRequest {
  sessionId: string;
  ownerId: string;
  payload: z.infer<typeof signChunkSchema>;
}

export class MediaChunkService {
  constructor(
    private readonly chunks: MediaChunkRepository,
    private readonly sessions: ExamSessionRepository,
    private readonly s3: IS3Service,
    private readonly rateLimiter: RateLimiter,
    private readonly bucket: string
  ) {}

  async requestUploadUrl(request: SignChunkRequest) {
    const { sessionId, ownerId, payload } = request;
    const session = this.sessions.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.ownerId !== ownerId) {
      throw new Error("Forbidden");
    }
    if (session.status !== "ACTIVE") {
      throw new Error(`Cannot upload when session status is ${session.status}`);
    }
    if (payload.streamType === "screen" && !session.includeScreen) {
      throw new Error("Screen recording not enabled for this session");
    }

    this.rateLimiter.consume(`${sessionId}:${payload.streamType}`);

    const existingChunks = this.chunks.findBySessionAndStream(sessionId, payload.streamType);
    if (existingChunks.some((chunk) => chunk.chunkIndex === payload.chunkIndex)) {
      throw new Error(`Chunk index ${payload.chunkIndex} already exists for ${payload.streamType}`);
    }

    const storageKey = `examSessions/${sessionId}/${payload.streamType}/chunk-${payload.chunkIndex}.webm`;
    const signed = await this.s3.getPresignedUploadUrl({
      bucket: this.bucket,
      key: storageKey,
      contentType: payload.mimeType,
      byteSize: payload.byteSize,
      checksumSha256: payload.checksum,
      expiresInSeconds: 900
    });

    const created = this.chunks.create({
      sessionId,
      streamType: payload.streamType,
      chunkIndex: payload.chunkIndex,
      status: "PENDING",
      storageKey,
      uploadUrl: signed.uploadUrl
    });

    return {
      chunkId: created.id,
      uploadUrl: signed.uploadUrl,
      storageKey,
      expiresAt: signed.expiresAt
    };
  }

  markUploaded(args: {
    sessionId: string;
    ownerId: string;
    chunkId: string;
    checksum: string;
    byteSize: number;
  }) {
    const { sessionId, ownerId, chunkId, checksum, byteSize } = args;
    const session = this.sessions.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.ownerId !== ownerId) {
      throw new Error("Forbidden");
    }

    const chunk = this.chunks.findById(chunkId);
    if (!chunk) {
      throw new Error("Chunk not found");
    }
    if (chunk.sessionId !== sessionId) {
      throw new Error("Chunk does not belong to session");
    }

    this.chunks.updateMetadata(chunkId, {
      status: "UPLOADED",
      checksum,
      byteSize
    });
  }

  listChunksForSession(sessionId: string, streamType?: StreamType): ManifestChunkEntry[] {
    const rows = streamType
      ? this.chunks.findBySessionAndStream(sessionId, streamType)
      : this.chunks.findBySession(sessionId);

    return rows
      .filter((row) => row.status === "UPLOADED")
      .map((row) => {
        if (!row.storageKey || !row.checksum || !row.byteSize) {
          throw new Error(`Chunk ${row.id} missing required metadata`);
        }
        return {
          chunkId: row.id,
          chunkIndex: row.chunkIndex,
          storageKey: row.storageKey,
          checksum: row.checksum,
          byteSize: row.byteSize
        } satisfies ManifestChunkEntry;
      })
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async deleteChunks(sessionId: string): Promise<string[]> {
    const chunks = this.chunks.findBySession(sessionId);
    const deletedKeys: string[] = [];
    for (const chunk of chunks) {
      if (chunk.storageKey) {
        await this.s3.deleteObject(this.bucket, chunk.storageKey);
        deletedKeys.push(chunk.storageKey);
      }
    }
    this.chunks.deleteBySession(sessionId);
    return deletedKeys;
  }
}
