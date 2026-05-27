import type {
  MusicConnector,
  ConnectorManifest,
  ConnectorCtx,
  TokenBundle,
  Page,
  ExternalTrack,
  ExternalPlaylist,
} from '@open-music/shared';

const YOUTUBE_MUSIC_MANIFEST: ConnectorManifest = {
  id: 'youtube_music',
  displayName: 'YouTube Music',
  authMethod: 'oauth2',
  capabilities: {
    importLibrary: true,
    importPlaylists: true,
    importHistory: true,
    directPlayback: false,
    webhooks: false,
    isrcAvailable: false,
    lyrics: false,
  },
  rateLimits: { perMinute: 100, perDay: 10000 },
};

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeMusicConnector implements MusicConnector {
  manifest = YOUTUBE_MUSIC_MANIFEST;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  async startAuth(_userId: string): Promise<{ redirectUrl: string; state: string }> {
    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return { redirectUrl: `${GOOGLE_OAUTH_URL}?${params}`, state };
  }

  async handleCallback(_state: string, params: Record<string, string>): Promise<TokenBundle> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code ?? '',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
    const data = await res.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: (data.scope ?? '').split(' '),
    };
  }

  async refresh(token: TokenBundle): Promise<TokenBundle> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken ?? '',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
    const data = await res.json();

    return {
      accessToken: data.access_token,
      refreshToken: token.refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: (data.scope ?? '').split(' '),
    };
  }

  async revoke(token: TokenBundle): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${token.accessToken}`, {
      method: 'POST',
    });
  }

  async listPlaylists(ctx: ConnectorCtx, cursor?: string): Promise<Page<ExternalPlaylist>> {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
    });
    if (cursor) params.set('pageToken', cursor);

    const res = await this.apiGet(ctx, `/playlists?${params}`);

    return {
      items: (res.items ?? []).map((item: any) => ({
        externalId: item.id,
        name: item.snippet.title,
        description: item.snippet.description,
        trackCount: item.contentDetails?.itemCount ?? 0,
        coverUrl: item.snippet.thumbnails?.medium?.url,
        isPublic: item.status?.privacyStatus === 'public',
      })),
      cursor: res.nextPageToken ?? undefined,
      hasMore: !!res.nextPageToken,
      total: res.pageInfo?.totalResults,
    };
  }

  async listLikedTracks(ctx: ConnectorCtx, cursor?: string): Promise<Page<ExternalTrack>> {
    // YouTube "Liked videos" playlist is "LL"
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: 'LL',
      maxResults: '50',
    });
    if (cursor) params.set('pageToken', cursor);

    const res = await this.apiGet(ctx, `/playlistItems?${params}`);

    return {
      items: (res.items ?? []).map((item: any) => this.mapPlaylistItem(item)),
      cursor: res.nextPageToken ?? undefined,
      hasMore: !!res.nextPageToken,
      total: res.pageInfo?.totalResults,
    };
  }

  async listRecentlyPlayed(ctx: ConnectorCtx, _since?: Date): Promise<ExternalTrack[]> {
    // YouTube Data API doesn't provide listen history directly
    // We use "HL" (History) playlist as best effort
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: 'HL',
      maxResults: '50',
    });

    try {
      const res = await this.apiGet(ctx, `/playlistItems?${params}`);
      return (res.items ?? []).map((item: any) => this.mapPlaylistItem(item));
    } catch {
      return [];
    }
  }

  async getTrack(ctx: ConnectorCtx, externalId: string): Promise<ExternalTrack> {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: externalId,
    });
    const res = await this.apiGet(ctx, `/videos?${params}`);
    const item = res.items?.[0];
    if (!item) throw new Error(`Track ${externalId} not found`);
    return this.mapVideo(item);
  }

  getDeepLink(externalId: string): string {
    return `https://music.youtube.com/watch?v=${externalId}`;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async apiGet(ctx: ConnectorCtx, path: string): Promise<any> {
    const url = path.startsWith('http') ? path : `${YT_API_BASE}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ctx.token.accessToken}` },
    });

    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      throw new Error(`RATE_LIMITED:${retryAfter ?? '60'}`);
    }
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

    return res.json();
  }

  private mapPlaylistItem(item: any): ExternalTrack {
    const snippet = item.snippet ?? {};
    return {
      externalId: item.contentDetails?.videoId ?? snippet.resourceId?.videoId ?? '',
      title: snippet.title ?? '',
      artists: [snippet.videoOwnerChannelTitle ?? ''].filter(Boolean),
      durationMs: 0, // Would need separate video details call
      coverUrl: snippet.thumbnails?.medium?.url,
      availability: snippet.title === 'Deleted video' ? 'unavailable' : 'playable',
    };
  }

  private mapVideo(item: any): ExternalTrack {
    const snippet = item.snippet ?? {};
    const duration = this.parseDuration(item.contentDetails?.duration ?? '');
    return {
      externalId: item.id,
      title: snippet.title ?? '',
      artists: [snippet.channelTitle ?? ''],
      durationMs: duration,
      coverUrl: snippet.thumbnails?.medium?.url,
      availability: 'playable',
    };
  }

  private parseDuration(iso8601: string): number {
    const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] ?? '0', 10);
    const minutes = parseInt(match[2] ?? '0', 10);
    const seconds = parseInt(match[3] ?? '0', 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }
}

export { YOUTUBE_MUSIC_MANIFEST };
