import { RecordingStreamType } from "./types";

export interface StoredChunkPayload {
  id: string;
  sessionId: string;
  streamType: RecordingStreamType;
  chunkIndex: number;
  createdAt: number;
  durationMs: number;
  blob: Blob;
}

const DB_NAME = "exam-media-chunks";
const STORE_NAME = "chunks";
const DB_VERSION = 1;

const isIndexedDbAvailable = () => typeof indexedDB !== "undefined";

export class OfflineChunkStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    if (!isIndexedDbAvailable()) {
      throw new Error("IndexedDB is not available in this environment");
    }
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    return this.dbPromise;
  }

  async saveChunk(chunk: StoredChunkPayload): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_NAME);
      store.put(chunk);
    });
  }

  async deleteChunk(id: string): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
    });
  }

  async readAllChunks(): Promise<StoredChunkPayload[]> {
    if (!isIndexedDbAvailable()) return [];
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as StoredChunkPayload[]);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).clear();
    });
  }
}
