import { RecordingManifest } from "../serverTypes";
import { RecordingStreamType } from "../types";

export interface ManifestPlayerConfig {
  manifestUrl: string;
  videoElement: HTMLVideoElement;
  preferredStream?: RecordingStreamType;
  mimeType?: string;
}

const defaultMimeType = "video/webm;codecs=vp9,opus";

export class ManifestPlayer {
  private manifest: RecordingManifest | null = null;

  constructor(private readonly config: ManifestPlayerConfig) {}

  async load(): Promise<void> {
    const response = await fetch(this.config.manifestUrl);
    if (!response.ok) {
      throw new Error(`Unable to load manifest: ${response.statusText}`);
    }
    this.manifest = (await response.json()) as RecordingManifest;

    const stream = this.selectStream();
    if (!stream) {
      throw new Error("Manifest does not contain any streams");
    }

    if (typeof window !== "undefined" && "MediaSource" in window) {
      await this.playWithMediaSource(stream);
    } else {
      await this.playByConcatenation(stream);
    }
  }

  private selectStream() {
    if (!this.manifest) return null;
    if (this.config.preferredStream) {
      return this.manifest.streams.find((stream) => stream.streamType === this.config.preferredStream) ??
        this.manifest.streams[0];
    }
    return this.manifest.streams[0];
  }

  private async playWithMediaSource(stream: RecordingManifest["streams"][number]): Promise<void> {
    const mediaSource = new MediaSource();
    this.config.videoElement.src = URL.createObjectURL(mediaSource);

    await new Promise<void>((resolve, reject) => {
      mediaSource.addEventListener("sourceopen", async () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer(this.config.mimeType ?? defaultMimeType);
          for (const chunk of stream.chunks) {
            const response = await fetch(this.resolveChunkUrl(chunk.storageKey));
            if (!response.ok) {
              throw new Error(`Failed to fetch chunk ${chunk.storageKey}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            await this.appendBuffer(sourceBuffer, arrayBuffer);
          }
          mediaSource.endOfStream();
          resolve();
        } catch (error) {
          reject(error);
        }
      }, { once: true });
    });
  }

  private async playByConcatenation(stream: RecordingManifest["streams"][number]): Promise<void> {
    const blobs: Blob[] = [];
    for (const chunk of stream.chunks) {
      const response = await fetch(this.resolveChunkUrl(chunk.storageKey));
      if (!response.ok) {
        throw new Error(`Failed to fetch chunk ${chunk.storageKey}`);
      }
      const blob = await response.blob();
      blobs.push(blob);
    }
    const merged = new Blob(blobs, { type: this.config.mimeType ?? defaultMimeType });
    this.config.videoElement.src = URL.createObjectURL(merged);
    await this.config.videoElement.play();
  }

  private appendBuffer(sourceBuffer: SourceBuffer, buffer: ArrayBuffer) {
    return new Promise<void>((resolve, reject) => {
      const onUpdateEnd = () => {
        sourceBuffer.removeEventListener("updateend", onUpdateEnd);
        resolve();
      };
      sourceBuffer.addEventListener("updateend", onUpdateEnd);
      sourceBuffer.addEventListener("error", () => {
        sourceBuffer.removeEventListener("updateend", onUpdateEnd);
        reject(new Error("Failed to append buffer"));
      }, { once: true });
      sourceBuffer.appendBuffer(buffer);
    });
  }

  private resolveChunkUrl(storageKey: string): string {
    if (!this.manifest) return storageKey;
    if (this.manifest.sessionId && storageKey.startsWith("http")) {
      return storageKey;
    }
    const base = new URL(this.config.manifestUrl);
    base.pathname = `${base.pathname.replace(/\/[^/]*$/, "/")}${storageKey}`;
    return base.toString();
  }
}
