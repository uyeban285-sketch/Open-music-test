import type {
  MusicConnector,
  ConnectorManifest,
  ConnectorCtx,
  TokenBundle,
  Page,
  ExternalTrack,
  ExternalPlaylist,
} from '@open-music/shared';

const FILE_IMPORT_MANIFEST: ConnectorManifest = {
  id: 'file_import',
  displayName: 'File Import (JSON/CSV/OPML/ZIP)',
  authMethod: 'file_import',
  capabilities: {
    importLibrary: true,
    importPlaylists: true,
    importHistory: false,
    directPlayback: false,
    webhooks: false,
    isrcAvailable: false,
    lyrics: false,
  },
  rateLimits: { perMinute: 999, perDay: 99999 },
};

// ─── Parsers ─────────────────────────────────────────────────────────────────

interface ParsedImport {
  playlists: ExternalPlaylist[];
  tracks: ExternalTrack[];
}

/** Parse Spotify JSON export format */
export function parseSpotifyJson(data: any): ParsedImport {
  const tracks: ExternalTrack[] = [];
  const playlists: ExternalPlaylist[] = [];

  if (Array.isArray(data)) {
    // Array of streaming history entries
    for (const entry of data) {
      tracks.push({
        externalId: `spotify:${entry.artistName}:${entry.trackName}`,
        title: entry.trackName ?? '',
        artists: [entry.artistName ?? ''],
        durationMs: (entry.msPlayed ?? 0),
        availability: 'unavailable',
      });
    }
  } else if (data.playlists) {
    // Spotify playlists export
    for (const pl of data.playlists) {
      playlists.push({
        externalId: `spotify:playlist:${pl.name}`,
        name: pl.name ?? 'Untitled',
        trackCount: pl.items?.length ?? 0,
      });
      for (const item of pl.items ?? []) {
        if (item.track) {
          tracks.push({
            externalId: item.track.trackUri ?? `spotify:${item.track.artistName}:${item.track.trackName}`,
            title: item.track.trackName ?? '',
            artists: [item.track.artistName ?? ''],
            album: item.track.albumName,
            durationMs: 0,
            availability: 'unavailable',
          });
        }
      }
    }
  }

  return { playlists, tracks };
}

/** Parse Apple Music CSV export */
export function parseAppleMusicCsv(csvContent: string): ParsedImport {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { playlists: [], tracks: [] };

  const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const titleIdx = headers.findIndex((h) => h.includes('title') || h.includes('name'));
  const artistIdx = headers.findIndex((h) => h.includes('artist'));
  const albumIdx = headers.findIndex((h) => h.includes('album'));

  const tracks: ExternalTrack[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const title = titleIdx >= 0 ? cols[titleIdx] ?? '' : '';
    const artist = artistIdx >= 0 ? cols[artistIdx] ?? '' : '';
    const album = albumIdx >= 0 ? cols[albumIdx] : undefined;

    if (title) {
      tracks.push({
        externalId: `apple:${artist}:${title}`,
        title,
        artists: artist ? [artist] : [],
        album,
        durationMs: 0,
        availability: 'unavailable',
      });
    }
  }

  return { playlists: [], tracks };
}

/** Parse generic OPML/XML playlist list */
export function parseOpml(xmlContent: string): ParsedImport {
  const playlists: ExternalPlaylist[] = [];
  const titleMatches = xmlContent.matchAll(/<outline[^>]*text="([^"]*)"[^>]*/g);

  for (const match of titleMatches) {
    playlists.push({
      externalId: `opml:${match[1]}`,
      name: match[1] ?? 'Unknown',
      trackCount: 0,
    });
  }

  return { playlists, tracks: [] };
}

// ─── File Import Connector ───────────────────────────────────────────────────

export class FileImportConnector implements MusicConnector {
  manifest = FILE_IMPORT_MANIFEST;

  // Auth methods are no-ops for file import
  async startAuth(_userId: string): Promise<{ redirectUrl: string; state: string }> {
    return { redirectUrl: '', state: 'file_import' };
  }

  async handleCallback(_state: string, _params: Record<string, string>): Promise<TokenBundle> {
    return {
      accessToken: '',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      scope: [],
    };
  }

  async refresh(token: TokenBundle): Promise<TokenBundle> {
    return token;
  }

  async revoke(_token: TokenBundle): Promise<void> {}

  // Library methods are no-ops — data comes from import
  async listPlaylists(_ctx: ConnectorCtx, _cursor?: string): Promise<Page<ExternalPlaylist>> {
    return { items: [], hasMore: false };
  }

  async listLikedTracks(_ctx: ConnectorCtx, _cursor?: string): Promise<Page<ExternalTrack>> {
    return { items: [], hasMore: false };
  }

  async listRecentlyPlayed(_ctx: ConnectorCtx, _since?: Date): Promise<ExternalTrack[]> {
    return [];
  }

  async getTrack(_ctx: ConnectorCtx, _externalId: string): Promise<ExternalTrack> {
    throw new Error('File import connector does not support getTrack');
  }

  getDeepLink(_externalId: string): string {
    return '';
  }

  /**
   * Import file content. Called by the integrations service.
   * Detects format and parses accordingly.
   */
  static parseFile(content: string | Buffer, filename: string): ParsedImport {
    const ext = filename.toLowerCase().split('.').pop();
    const text = typeof content === 'string' ? content : content.toString('utf-8');

    switch (ext) {
      case 'json': {
        const data = JSON.parse(text);
        return parseSpotifyJson(data);
      }
      case 'csv':
        return parseAppleMusicCsv(text);
      case 'opml':
      case 'xml':
        return parseOpml(text);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }
}

export { FILE_IMPORT_MANIFEST };
