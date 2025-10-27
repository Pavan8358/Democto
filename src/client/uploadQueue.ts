import { OfflineChunkStore, StoredChunkPayload } from "./offlineChunkStore";
import { ChunkUploadResult, RecordingStreamType } from "./types";

interface UploadApi {
  requestSignedUrl(input: {
    streamType: RecordingStreamType;
    chunkIndex: number;
    byteSize: number;
    checksum: string;
    mimeType: string;
  }): Promise<{ chunkId: string; uploadUrl: string; storageKey: string }>;
  markChunkUploaded(input: { chunkId: string; checksum: string; byteSize: number }): Promise<void>;
}

export interface PendingChunk {
  id: string;
  streamType: RecordingStreamType;
  chunkIndex: number;
  durationMs: number;
  blob: Blob;
  persistedId?: string;
}

export interface UploadQueueOptions {
  sessionId: string;
  api: UploadApi;
  mimeType: string;
  maxRetries: number;
  offlineStore: OfflineChunkStore;
  onChunkUploaded?: (result: ChunkUploadResult) => void;
  onError?: (error: Error) => void;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const computeChecksum = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return bufferToBase64(hash);
};

const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

export class UploadQueue {
  private queue: PendingChunk[] = [];

  private processing = false;

  private idleResolvers: Array<() => void> = [];

  constructor(private readonly options: UploadQueueOptions) {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        void this.flushOffline();
      });
    }
  }

  enqueue(chunk: PendingChunk): void {
    this.queue.push(chunk);
    void this.processQueue();
  }

  private async flushOffline(): Promise<void> {
    const offlineChunks = await this.options.offlineStore.readAllChunks();
    if (offlineChunks.length === 0) {
      return;
    }
    for (const offlineChunk of offlineChunks) {
      this.queue.unshift({
        id: offlineChunk.id,
        streamType: offlineChunk.streamType,
        chunkIndex: offlineChunk.chunkIndex,
        blob: offlineChunk.blob,
        durationMs: offlineChunk.durationMs,
        persistedId: offlineChunk.id
      });
    }
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await this.uploadChunk(item);
      } catch (error) {
        this.processing = false;
        if (this.options.onError) {
          this.options.onError(error as Error);
        }
        if (!isOnline()) {
          await this.persistOffline(item);
        }
        return;
      }
    }
    this.processing = false;
    this.notifyIdle();
  }

  private async persistOffline(chunk: PendingChunk): Promise<void> {
    if (chunk.persistedId) {
      return;
    }
    const stored: StoredChunkPayload = {
      id: chunk.id,
      sessionId: this.options.sessionId,
      streamType: chunk.streamType,
      chunkIndex: chunk.chunkIndex,
      createdAt: Date.now(),
      durationMs: chunk.durationMs,
      blob: chunk.blob
    };
    await this.options.offlineStore.saveChunk(stored);
    chunk.persistedId = stored.id;
  }

  private async uploadChunk(chunk: PendingChunk): Promise<void> {
    const checksum = await computeChecksum(chunk.blob);
    const byteSize = chunk.blob.size;

    const perform = async (attempt: number): Promise<void> => {
      try {
        const signed = await this.options.api.requestSignedUrl({
          streamType: chunk.streamType,
          chunkIndex: chunk.chunkIndex,
          byteSize,
          checksum,
          mimeType: this.options.mimeType
        });

        await fetch(signed.uploadUrl, {
          method: "PUT",
          body: chunk.blob,
          headers: {
            "Content-Type": this.options.mimeType,
            "Content-Length": String(byteSize),
            "x-amz-checksum-sha256": checksum
          }
        });

        await this.options.api.markChunkUploaded({
          chunkId: signed.chunkId,
          checksum,
          byteSize
        });

        if (this.options.onChunkUploaded) {
          this.options.onChunkUploaded({
            chunkId: signed.chunkId,
            chunkIndex: chunk.chunkIndex,
            streamType: chunk.streamType,
            byteSize,
            checksum,
            storageKey: signed.storageKey,
            uploadedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        if (!isOnline()) {
          throw error;
        }
        if (attempt >= this.options.maxRetries) {
          throw error;
        }
        const backoff = 2 ** attempt * 1000;
        await delay(backoff);
        await perform(attempt + 1);
      }
    };

    await perform(0);
    if (chunk.persistedId) {
      await this.options.offlineStore.deleteChunk(chunk.persistedId);
      chunk.persistedId = undefined;
    }
  }

  async waitForIdle(): Promise<void> {
    if (!this.processing && this.queue.length === 0) {
      return;
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private notifyIdle(): void {
    if (this.queue.length === 0 && !this.processing) {
      while (this.idleResolvers.length > 0) {
        const resolver = this.idleResolvers.shift();
        resolver?.();
      }
    }
  }
}
