export type SessionStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "FAILED" | "ABORTED";
export type ChunkStatus = "PENDING" | "UPLOADING" | "UPLOADED" | "FAILED" | "DELETED";
export type StreamType = "webcam" | "screen";

export interface ExamSession {
  id: string;
  ownerId: string;
  includeScreen: boolean;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  totalDurationMs?: number | null;
  manifestUrl?: string | null;
  failureReason?: string | null;
}

export interface MediaChunk {
  id: string;
  sessionId: string;
  streamType: StreamType;
  chunkIndex: number;
  status: ChunkStatus;
  checksum?: string | null;
  byteSize?: number | null;
  storageKey?: string | null;
  uploadUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Recording {
  id: string;
  sessionId: string;
  streamType: StreamType;
  durationMs: number;
  manifestJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingChunk {
  id: string;
  recordingId: string;
  chunkId: string;
  position: number;
  createdAt: string;
}

export interface ManifestChunkEntry {
  chunkId: string;
  chunkIndex: number;
  storageKey: string;
  checksum: string;
  byteSize: number;
}

export interface RecordingManifestStream {
  streamType: StreamType;
  durationMs: number;
  chunks: ManifestChunkEntry[];
}

export interface RecordingManifest {
  sessionId: string;
  createdAt: string;
  totalDurationMs: number;
  streams: RecordingManifestStream[];
}
