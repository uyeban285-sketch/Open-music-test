import type {
  MusicConnector,
  ConnectorManifest,
  ConnectorCtx,
  TokenBundle,
  Page,
  ExternalTrack,
  ExternalPlaylist,
  Lyrics,
} from '@open-music/shared';

const YANDEX_MUSIC_MANIFEST: ConnectorManifest = {
  id: 'yandex_music',
  displayName: 'Яндекс Музыка',
  authMethod: 'oauth2',
  capabilities: {
    importLibrary: true,
    importPlaylists: true,
    importHistory: true,
    directPlayback: false,
    webhooks: false,
    isrcAvailable: true,
    lyrics: true,
  },
  rateLimits: { perMinute: 60, perDay: 5000 },
};

const YANDEX_OAUTH_URL = 'https://oauth.yandex.ru/authorize';
const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';
const YANDEX_API_BASE = 'https://api.music.yandex.net';

export class YandexMusicConnector implements MusicConnector {
  manifest = YANDEX_MUSIC_MANIFEST;

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
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });
    return { redirectUrl: `${YANDEX_OAUTH_URL}?${params}`, state };
  }

  async handleCallback(_state: string, params: Record<string, string>): Promise<TokenBundle> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code ?? '',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(YANDEX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Yandex token exchange failed: ${res.status}`);
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

    const res = await fetch(YANDEX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Yandex token refresh failed: ${res.status}`);
    const data = await res.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: (data.scope ?? '').split(' '),
    };
  }

  async revoke(_token: TokenBundle): Promise<void> {
    // Yandex doesn't have a public revoke endpoint; we just discard locally
  }

  async listPlaylists(ctx: ConnectorCtx, cursor?: string): Promise<Page<ExternalPlaylist>> {
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const res = await this.apiGet(ctx, `/users/${ctx.userId}/playlists/list`);
    const playlists = (res.result ?? []).slice(offset, offset + 50);

    return {
      items: playlists.map((p: any) => ({
        externalId: `${p.uid}:${p.kind}`,
        name: p.title,
        description: p.description,
        trackCount: p.trackCount ?? 0,
        coverUrl: p.ogImage ? `https://${p.ogImage.replace('%%', '200x200')}` : undefined,
        isPublic: p.visibility === 'public',
      })),
      cursor: offset + 50 < (res.result?.length ?? 0) ? String(offset + 50) : undefined,
      hasMore: offset + 50 < (res.result?.length ?? 0),
    };
  }

  async listLikedTracks(ctx: ConnectorCtx, cursor?: string): Promise<Page<ExternalTrack>> {
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const res = await this.apiGet(ctx, `/users/${ctx.userId}/likes/tracks`);
    const library = res.result?.library ?? { tracks: [] };
    const tracks = library.tracks.slice(offset, offset + 100);

    return {
      items: tracks.map((item: any) => this.mapTrack(item.track ?? item)),
      cursor: offset + 100 < library.tracks.length ? String(offset + 100) : undefined,
      hasMore: offset + 100 < library.tracks.length,
      total: library.tracks.length,
    };
  }

  async listRecentlyPlayed(ctx: ConnectorCtx, _since?: Date): Promise<ExternalTrack[]> {
    const res = await this.apiGet(ctx, '/users/${ctx.userId}/plays');
    return (res.result ?? []).map((item: any) => this.mapTrack(item.track ?? item));
  }

  async getTrack(ctx: ConnectorCtx, externalId: string): Promise<ExternalTrack> {
    const res = await this.apiGet(ctx, `/tracks/${externalId}`);
    const track = res.result?.[0] ?? res.result;
    return this.mapTrack(track);
  }

  getDeepLink(externalId: string): string {
    return `https://music.yandex.ru/track/${externalId}`;
  }

  async getLyrics(ctx: ConnectorCtx, externalId: string): Promise<Lyrics | null> {
    try {
      const res = await this.apiGet(ctx, `/tracks/${externalId}/lyrics`);
      if (!res.result) return null;
      return {
        text: res.result.fullLyrics ?? '',
        source: 'yandex_music',
      };
    } catch {
      return null;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async apiGet(ctx: ConnectorCtx, path: string): Promise<any> {
    const res = await fetch(`${YANDEX_API_BASE}${path}`, {
      headers: { Authorization: `OAuth ${ctx.token.accessToken}` },
    });

    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      throw new Error(`RATE_LIMITED:${retryAfter ?? '60'}`);
    }
    if (!res.ok) throw new Error(`Yandex API error: ${res.status}`);

    return res.json();
  }

  private mapTrack(raw: any): ExternalTrack {
    return {
      externalId: String(raw.id),
      isrc: raw.isrc ?? undefined,
      title: raw.title ?? '',
      artists: (raw.artists ?? []).map((a: any) => a.name),
      album: raw.albums?.[0]?.title,
      durationMs: (raw.durationMs ?? 0),
      coverUrl: raw.coverUri ? `https://${raw.coverUri.replace('%%', '200x200')}` : undefined,
      explicit: raw.explicit ?? false,
      isLive: raw.type === 'music' ? false : raw.liveStatus === 'live',
      genre: raw.genre ? [raw.genre] : undefined,
      availability: raw.available !== false ? 'playable' : 'unavailable',
    };
  }
}

export { YANDEX_MUSIC_MANIFEST };
