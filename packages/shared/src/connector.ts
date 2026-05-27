/**
 * Connector abstraction — core interface for external music service integrations.
 * The core system (player, library, AI, UI) does not know about specific External_Services.
 * Any external service connects through this unified MusicConnector interface.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConnectorId = string; // 'yandex_music' | 'youtube_music' | 'file_import' | 'local_ai'

export type ConnectionStatus =
  | 'Connected'
  | 'Disconnected'
  | 'Error'
  | 'Token_Expired'
  | 'Reauth_Required';

export interface ConnectorManifest {
  id: ConnectorId;
  displayName: string;
  authMethod: 'oauth2' | 'oidc' | 'file_import' | 'api_key';
  capabilities: {
    importLibrary: boolean;
    importPlaylists: boolean;
    importHistory: boolean;
    directPlayback: boolean;
    webhooks: boolean;
    isrcAvailable: boolean;
    lyrics: boolean;
  };
  rateLimits: {
    perMinute: number;
    perDay: number;
  };
}

export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string[];
}

export interface ConnectorCtx {
  userId: string;
  token: TokenBundle;
  connectorId: ConnectorId;
}

export interface Page<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface AudioFeatures {
  bpm: number;
  energy: number; // 0..1
  valence: number; // 0..1
  danceability: number; // 0..1
  key: string;
  loudness: number; // dB
  speechiness: number; // 0..1
  acousticness: number; // 0..1
  instrumentalness: number; // 0..1
}

export interface ExternalTrack {
  externalId: string;
  isrc?: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs: number;
  coverUrl?: string;
  explicit?: boolean;
  isLive?: boolean;
  genre?: string;
  audioFeatures?: Partial<AudioFeatures>;
  availability: 'playable' | 'preview_only' | 'unavailable' | 'region_locked';
}

export interface ExternalPlaylist {
  externalId: string;
  name: string;
  description?: string;
  trackCount: number;
  coverUrl?: string;
  isPublic?: boolean;
}

export interface PlaybackHandle {
  streamUrl: string;
  format: 'mp3' | 'flac' | 'ogg' | 'opus' | 'aac';
  bitrate?: number;
  expiresAt: Date;
}

export interface Lyrics {
  text: string;
  synced?: Array<{ startMs: number; endMs: number; line: string }>;
  source: string;
}

// ─── MusicConnector Interface ────────────────────────────────────────────────

export interface MusicConnector {
  manifest: ConnectorManifest;

  // Auth
  startAuth(userId: string): Promise<{ redirectUrl: string; state: string }>;
  handleCallback(state: string, params: Record<string, string>): Promise<TokenBundle>;
  refresh(token: TokenBundle): Promise<TokenBundle>;
  revoke(token: TokenBundle): Promise<void>;

  // Library
  listPlaylists(ctx: ConnectorCtx, cursor?: string): Promise<Page<ExternalPlaylist>>;
  listLikedTracks(ctx: ConnectorCtx, cursor?: string): Promise<Page<ExternalTrack>>;
  listRecentlyPlayed(ctx: ConnectorCtx, since?: Date): Promise<ExternalTrack[]>;
  getTrack(ctx: ConnectorCtx, externalId: string): Promise<ExternalTrack>;

  // Playback (optional — only for connectors that support direct playback)
  resolvePlayback?(ctx: ConnectorCtx, externalId: string): Promise<PlaybackHandle>;
  getDeepLink(externalId: string): string;

  // Lyrics / extras (optional)
  getLyrics?(ctx: ConnectorCtx, externalId: string): Promise<Lyrics | null>;
}

// ─── ConnectorRegistry ───────────────────────────────────────────────────────

export class ConnectorRegistry {
  private connectors = new Map<ConnectorId, MusicConnector>();

  register(connector: MusicConnector): void {
    if (this.connectors.has(connector.manifest.id)) {
      throw new Error(`Connector "${connector.manifest.id}" already registered`);
    }
    this.connectors.set(connector.manifest.id, connector);
  }

  get(id: ConnectorId): MusicConnector {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connector "${id}" not found`);
    }
    return connector;
  }

  list(): ConnectorManifest[] {
    return Array.from(this.connectors.values()).map((c) => c.manifest);
  }

  has(id: ConnectorId): boolean {
    return this.connectors.has(id);
  }
}
