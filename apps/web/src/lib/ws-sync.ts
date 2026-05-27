/**
 * WebSocket client for cross-device playback sync.
 * Connects to /ws/playback namespace, handles state convergence via monotonic revision.
 */

export interface PlaybackStateMsg {
  currentTrackId: string | null;
  positionMs: number;
  isPlaying: boolean;
  queue: string[];
  repeatMode: string;
  shuffle: boolean;
  revision: number;
}

type Listener = (state: PlaybackStateMsg) => void;

export class PlaybackSyncClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private deviceId: string;
  private listeners: Set<Listener> = new Set();
  private localRevision = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, token: string, deviceId: string) {
    this.url = url;
    this.token = token;
    this.deviceId = deviceId;
  }

  connect(): void {
    if (this.ws) return;
    this.ws = new WebSocket(`${this.url}?token=${this.token}&deviceId=${this.deviceId}`);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: PlaybackStateMsg };
        if (msg.type === 'state' || msg.type === 'remote-change') {
          // Only accept if revision > local (convergence rule)
          if (msg.payload.revision > this.localRevision) {
            this.localRevision = msg.payload.revision;
            this.listeners.forEach((fn) => fn(msg.payload));
          }
        }
      } catch {
        /* ignore parse errors */
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  sendCommand(command: string, payload?: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'command', command, payload, deviceId: this.deviceId }));
    }
  }

  onStateChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => this.connect(), 3000);
  }
}
