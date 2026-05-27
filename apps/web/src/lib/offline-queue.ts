/**
 * Offline Action Queue — stores user actions when offline
 * and replays them when connectivity is restored.
 * Uses IndexedDB for persistence.
 */

interface QueuedAction {
  id: string;
  method: string;
  url: string;
  body?: unknown;
  timestamp: number;
}

const DB_NAME = 'open-music-offline';
const STORE_NAME = 'actions';

class OfflineQueue {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async enqueue(action: Omit<QueuedAction, 'id' | 'timestamp'>): Promise<void> {
    if (!this.db) await this.init();
    const entry: QueuedAction = { ...action, id: crypto.randomUUID(), timestamp: Date.now() };
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async drain(): Promise<QueuedAction[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async replay(): Promise<{ succeeded: number; failed: number }> {
    const actions = await this.drain();
    let succeeded = 0,
      failed = 0;

    for (const action of actions.sort((a, b) => a.timestamp - b.timestamp)) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: action.body ? JSON.stringify(action.body) : undefined,
        });
        await this.remove(action.id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    return { succeeded, failed };
  }
}

export const offlineQueue = new OfflineQueue();

// Auto-replay when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    offlineQueue.replay().then(({ succeeded, failed }) => {
      if (succeeded > 0)
        console.log(`[OfflineQueue] Replayed ${succeeded} actions, ${failed} failed`);
    });
  });
}
