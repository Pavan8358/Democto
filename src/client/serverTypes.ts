import { RecordingStreamType } from "./types";

export interface RecordingManifestChunk {
  chunkId: string;
  chunkIndex: number;
  storageKey: string;
  checksum: string;
  byteSize: number;
}

export interface RecordingManifestStream {
  streamType: RecordingStreamType;
  durationMs: number;
  chunks: RecordingManifestChunk[];
}

export interface RecordingManifest {
  sessionId: string;
  createdAt: string;
  totalDurationMs: number;
  streams: RecordingManifestStream[];
}
