export type RecordingStreamType = "webcam" | "screen";

export interface ChunkUploadResult {
  chunkId: string;
  chunkIndex: number;
  streamType: RecordingStreamType;
  byteSize: number;
  checksum: string;
  storageKey: string;
  uploadedAt: string;
}

export interface RecordingControllerConfig {
  sessionId: string;
  apiBaseUrl: string;
  ownerToken: string;
  includeScreen?: boolean;
  chunkDurationMs?: number;
  maxRetries?: number;
  mimeType?: string;
  onStatusChange?: (status: RecordingStatus) => void;
  onChunkUploaded?: (chunk: ChunkUploadResult) => void;
  onError?: (error: Error) => void;
}

export type RecordingStatus =
  | "idle"
  | "initialising"
  | "active"
  | "paused"
  | "stopped"
  | "failed";
