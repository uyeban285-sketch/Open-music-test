/**
 * JSON-based local store. No native modules, no wasm, no dependencies.
 * Data saved to %APPDATA%/open-music/data.json
 */
import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

interface Track {
  id: string; title: string; artist: string; album?: string;
  duration_ms: number; genre?: string; cover_url?: string;
  source: string; external_id?: string; connector_id?: string;
  isrc?: string; explicit: number; is_live: number;
  created_at: string; updated_at: string;
}

interface Playlist {
  id: string; name: string; description?: string;
  source?: string; external_id?: string;
  is_smart: number; pinned: number;
  created_at: string; updated_at: string;
}

interface PlaylistTrack {
  playlist_id: string; track_id: string; position: number; added_at: string;
}

interface HistoryEntry {
  id: string; track_id: string; started_at: string;
  duration_ms: number; skipped: number; context?: string;
}

interface Service {
  id: string; connector_id: string; status: string;
  access_token?: string; refresh_token?: string;
  expires_at?: string; connected_at: string;
}

interface Store {
  tracks: Record<string, Track>;
  playlists: Record<string, Playlist>;
  playlist_tracks: PlaylistTrack[];
  likes: Record<string, string>;
  history: HistoryEntry[];
  services: Record<string, Service>;
  settings: Record<string, string>;
}

const DEFAULTS: Record<string, string> = {
  theme: 'dark',
  visualizer_mode: 'bar',
  visualizer_intensity: '75',
  dynamic_palette: 'true',
  local_ai_enabled: 'false',
  local_ai_url: 'http://127.0.0.1:11434/v1',
  local_ai_model: 'llama3.1:8b-instruct',
};

let store: Store = {
  tracks: {}, playlists: {}, playlist_tracks: [],
  likes: {}, history: [], services: {}, settings: { ...DEFAULTS },
};
let storePath = '';

function now() { return new Date().toISOString(); }

function save() {
  if (!storePath) return;
  try { writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8'); } catch {}
}

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');
  if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true });
  storePath = join(userDataPath, 'data.json');

  if (existsSync(storePath)) {
    try {
      const loaded = JSON.parse(readFileSync(storePath, 'utf-8')) as Partial<Store>;
      store = {
        tracks: loaded.tracks ?? {},
        playlists: loaded.playlists ?? {},
        playlist_tracks: loaded.playlist_tracks ?? [],
        likes: loaded.likes ?? {},
        history: loaded.history ?? [],
        services: loaded.services ?? {},
        settings: { ...DEFAULTS, ...(loaded.settings ?? {}) },
      };
    } catch { /* corrupt file — start fresh */ }
  }
  save();
}

export function getDb() {
  return {
    // ── Tracks ──────────────────────────────────────────────────────────────
    tracks: {
      list(search?: string, limit = 50, offset = 0) {
        let items = Object.values(store.tracks);
        if (search) {
          const q = search.toLowerCase();
          items = items.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
        }
        items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return items.slice(offset, offset + limit);
      },
      get(id: string) { return store.tracks[id] ?? null; },
      count() { return { count: Object.keys(store.tracks).length }; },
      insert(t: Omit<Track, 'created_at' | 'updated_at'>) {
        if (!store.tracks[t.id]) {
          store.tracks[t.id] = { ...t, created_at: now(), updated_at: now() };
          save();
        }
      },
    },

    // ── Playlists ────────────────────────────────────────────────────────────
    playlists: {
      list() {
        return Object.values(store.playlists).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      },
      get(id: string) {
        const pl = store.playlists[id];
        if (!pl) return null;
        const tracks = store.playlist_tracks
          .filter(pt => pt.playlist_id === id)
          .sort((a, b) => a.position - b.position)
          .map(pt => ({ ...store.tracks[pt.track_id], position: pt.position }));
        return { ...pl, tracks };
      },
      create(id: string, name: string, description?: string) {
        store.playlists[id] = { id, name, description, is_smart: 0, pinned: 0, created_at: now(), updated_at: now() };
        save();
      },
      addTrack(playlistId: string, trackId: string) {
        const existing = store.playlist_tracks.filter(pt => pt.playlist_id === playlistId);
        const position = existing.length > 0 ? Math.max(...existing.map(pt => pt.position)) + 1 : 0;
        store.playlist_tracks.push({ playlist_id: playlistId, track_id: trackId, position, added_at: now() });
        save();
      },
      removeTrack(playlistId: string, trackId: string) {
        store.playlist_tracks = store.playlist_tracks.filter(pt => !(pt.playlist_id === playlistId && pt.track_id === trackId));
        save();
      },
    },

    // ── Likes ────────────────────────────────────────────────────────────────
    likes: {
      list() {
        return Object.keys(store.likes).map(id => store.tracks[id]).filter(Boolean);
      },
      toggle(trackId: string) {
        if (store.likes[trackId]) { delete store.likes[trackId]; save(); return false; }
        store.likes[trackId] = now(); save(); return true;
      },
      isLiked(trackId: string) { return !!store.likes[trackId]; },
    },

    // ── History ──────────────────────────────────────────────────────────────
    history: {
      add(entry: Omit<HistoryEntry, 'started_at'>) {
        store.history.unshift({ ...entry, started_at: now() });
        if (store.history.length > 5000) store.history = store.history.slice(0, 5000);
        save();
      },
      list(limit = 50) {
        return store.history.slice(0, limit).map(h => ({
          ...h, title: store.tracks[h.track_id]?.title,
          artist: store.tracks[h.track_id]?.artist,
          cover_url: store.tracks[h.track_id]?.cover_url,
        }));
      },
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    settings: {
      get(key: string) { return store.settings[key] ?? null; },
      set(key: string, value: string) { store.settings[key] = value; save(); },
      getAll() { return { ...store.settings }; },
    },

    // ── Services ─────────────────────────────────────────────────────────────
    services: {
      list() { return Object.values(store.services); },
      connect(id: string, connectorId: string, accessToken: string, refreshToken?: string, expiresAt?: string) {
        store.services[connectorId] = { id, connector_id: connectorId, status: 'Connected', access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, connected_at: now() };
        save();
      },
      disconnect(connectorId: string) { delete store.services[connectorId]; save(); },
    },

    // ── Import ───────────────────────────────────────────────────────────────
    importTracks(tracks: any[]) {
      let count = 0;
      for (const t of tracks) {
        const id = t.id ?? randomUUID();
        if (!store.tracks[id]) {
          store.tracks[id] = {
            id, title: t.title ?? '', artist: t.artist ?? t.artists?.join(', ') ?? '',
            album: t.album ?? undefined, duration_ms: t.durationMs ?? t.duration_ms ?? 0,
            genre: t.genre ?? undefined, cover_url: t.coverUrl ?? t.cover_url ?? undefined,
            source: t.source ?? 'import', external_id: t.externalId ?? t.external_id ?? undefined,
            connector_id: t.connectorId ?? t.connector_id ?? undefined,
            isrc: t.isrc ?? undefined, explicit: t.explicit ? 1 : 0, is_live: t.isLive ? 1 : 0,
            created_at: now(), updated_at: now(),
          };
          count++;
        }
      }
      save();
      return count;
    },
  };
}
