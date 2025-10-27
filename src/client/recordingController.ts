import { OfflineChunkStore } from "./offlineChunkStore";
import { PendingChunk, UploadQueue } from "./uploadQueue";
import {
  ChunkUploadResult,
  RecordingControllerConfig,
  RecordingStatus,
  RecordingStreamType
} from "./types";

const defaultChunkDuration = 10_000;
const defaultMaxRetries = 5;
const defaultMimeType = "video/webm;codecs=vp9,opus";

const createId = () => `${crypto.randomUUID()}`;

export class RecordingController {
  private status: RecordingStatus = "idle";

  private uploadQueue: UploadQueue | null = null;

  private offlineStore = new OfflineChunkStore();

  private webcamRecorder: MediaRecorder | null = null;

  private screenRecorder: MediaRecorder | null = null;

  private streams = new Map<RecordingStreamType, MediaStream>();

  private chunkIndices = new Map<RecordingStreamType, number>();

  private uploadedChunks: ChunkUploadResult[] = [];

  private sessionStartedAt = 0;

  private streamStartTimes = new Map<RecordingStreamType, number>();

  private readonly config: Required<Pick<RecordingControllerConfig, "chunkDurationMs" | "maxRetries" | "mimeType">> &
    RecordingControllerConfig;

  constructor(private readonly configuration: RecordingControllerConfig) {
    this.config = {
      ...configuration,
      chunkDurationMs: configuration.chunkDurationMs ?? defaultChunkDuration,
      maxRetries: configuration.maxRetries ?? defaultMaxRetries,
      mimeType: configuration.mimeType ?? defaultMimeType
    };
  }

  getStatus(): RecordingStatus {
    return this.status;
  }

  private setStatus(status: RecordingStatus) {
    this.status = status;
    this.configuration.onStatusChange?.(status);
  }

  private nextChunkIndex(streamType: RecordingStreamType): number {
    const current = this.chunkIndices.get(streamType) ?? 0;
    this.chunkIndices.set(streamType, current + 1);
    return current;
  }

  async start(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("Media recording is not supported in this environment");
    }
    if (this.status !== "idle" && this.status !== "stopped") {
      throw new Error(`Cannot start recorder from status ${this.status}`);
    }

    this.setStatus("initialising");

    await this.callStartSession();

    const webcamStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    this.streams.set("webcam", webcamStream);
    this.chunkIndices.set("webcam", 0);
    this.streamStartTimes.set("webcam", Date.now());

    if (this.configuration.includeScreen) {
      const displayMedia = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      this.streams.set("screen", displayMedia);
      this.chunkIndices.set("screen", 0);
      this.streamStartTimes.set("screen", Date.now());
    }

    this.uploadQueue = new UploadQueue({
      sessionId: this.configuration.sessionId,
      api: {
        requestSignedUrl: (input) => this.requestSignedUrl(input),
        markChunkUploaded: (input) => this.markChunkUploaded(input)
      },
      mimeType: this.config.mimeType,
      maxRetries: this.config.maxRetries,
      offlineStore: this.offlineStore,
      onChunkUploaded: (result) => {
        this.uploadedChunks.push(result);
        this.configuration.onChunkUploaded?.(result);
      },
      onError: (error) => {
        this.configuration.onError?.(error);
        this.setStatus("failed");
      }
    });

    this.setupRecorder("webcam", webcamStream);
    if (this.configuration.includeScreen) {
      const screenStream = this.streams.get("screen");
      if (screenStream) {
        this.setupRecorder("screen", screenStream);
      }
    }

    this.sessionStartedAt = Date.now();
    this.setStatus("active");
  }

  private setupRecorder(streamType: RecordingStreamType, stream: MediaStream) {
    const recorder = new MediaRecorder(stream, { mimeType: this.config.mimeType });
    recorder.ondataavailable = (event: BlobEvent) => {
      if (!event.data || event.data.size === 0) {
        return;
      }
      const queue = this.uploadQueue;
      if (!queue) return;
      const chunkIndex = this.nextChunkIndex(streamType);
      const chunk: PendingChunk = {
        id: createId(),
        streamType,
        chunkIndex,
        durationMs: this.config.chunkDurationMs,
        blob: event.data
      };
      queue.enqueue(chunk);
    };

    recorder.onerror = (event) => {
      const error = (event as unknown as { error?: Error }).error;
      if (error) {
        this.configuration.onError?.(error);
        this.setStatus("failed");
      }
    };

    recorder.start(this.config.chunkDurationMs);

    if (streamType === "webcam") {
      this.webcamRecorder = recorder;
    } else {
      this.screenRecorder = recorder;
    }
  }

  async pause(): Promise<void> {
    if (this.status !== "active") return;
    this.webcamRecorder?.pause();
    this.screenRecorder?.pause();
    this.setStatus("paused");
  }

  async resume(): Promise<void> {
    if (this.status !== "paused") return;
    this.webcamRecorder?.resume();
    this.screenRecorder?.resume();
    this.setStatus("active");
  }

  async stop(): Promise<void> {
    if (this.status !== "active" && this.status !== "paused") return;
    this.webcamRecorder?.stop();
    this.screenRecorder?.stop();
    this.streams.forEach((mediaStream) => {
      mediaStream.getTracks().forEach((track) => track.stop());
    });

    await this.uploadQueue?.waitForIdle();

    await this.finalizeSession();

    this.setStatus("stopped");
  }

  async abort(reason?: string): Promise<void> {
    this.webcamRecorder?.stop();
    this.screenRecorder?.stop();
    this.streams.forEach((mediaStream) => {
      mediaStream.getTracks().forEach((track) => track.stop());
    });
    await this.uploadQueue?.waitForIdle();
    try {
      await fetch(`${this.configuration.apiBaseUrl}/api/exam-sessions/${this.configuration.sessionId}/abort`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ reason })
      });
    } finally {
      await this.offlineStore.clear();
      this.setStatus("failed");
    }
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-owner-id": this.configuration.ownerToken
    };
  }

  private async callStartSession(): Promise<void> {
    const response = await fetch(`${this.configuration.apiBaseUrl}/api/exam-sessions/${this.configuration.sessionId}/start`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ includeScreen: !!this.configuration.includeScreen })
    });
    if (!response.ok) {
      throw new Error(`Failed to start exam session: ${response.statusText}`);
    }
  }

  private async requestSignedUrl(input: {
    streamType: RecordingStreamType;
    chunkIndex: number;
    byteSize: number;
    checksum: string;
    mimeType: string;
  }): Promise<{ chunkId: string; uploadUrl: string; storageKey: string }> {
    const response = await fetch(`${this.configuration.apiBaseUrl}/api/exam-sessions/${this.configuration.sessionId}/chunks/sign`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        streamType: input.streamType,
        chunkIndex: input.chunkIndex,
        byteSize: input.byteSize,
        checksum: input.checksum,
        mimeType: input.mimeType
      })
    });
    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }
    return response.json();
  }

  private async markChunkUploaded(input: { chunkId: string; checksum: string; byteSize: number }): Promise<void> {
    const response = await fetch(`${this.configuration.apiBaseUrl}/api/exam-sessions/${this.configuration.sessionId}/chunks/${input.chunkId}/complete`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      throw new Error(`Failed to mark chunk uploaded: ${response.statusText}`);
    }
  }

  private async finalizeSession(): Promise<void> {
    const byStream = new Map<RecordingStreamType, ChunkUploadResult[]>();
    for (const chunk of this.uploadedChunks) {
      const list = byStream.get(chunk.streamType) ?? [];
      list.push(chunk);
      byStream.set(chunk.streamType, list);
    }

    const streams = Array.from(byStream.entries()).map(([streamType, list]) => ({
      streamType,
      durationMs: Date.now() - (this.streamStartTimes.get(streamType) ?? this.sessionStartedAt),
      chunks: list
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((chunk) => ({ chunkId: chunk.chunkId, chunkIndex: chunk.chunkIndex }))
    }));

    const totalDuration = Date.now() - this.sessionStartedAt;

    const response = await fetch(`${this.configuration.apiBaseUrl}/api/exam-sessions/${this.configuration.sessionId}/finalize`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        totalDurationMs: totalDuration,
        streams
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to finalize recording: ${response.statusText}`);
    }

    await this.offlineStore.clear();
  }
}
