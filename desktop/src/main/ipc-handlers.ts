/**
 * IPC Handlers — мост между main (Node.js) и renderer (React UI).
 * Все операции с БД, файлами, и внешними API идут через IPC.
 */
import { ipcMain, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { getDb } from './database';

type DB = ReturnType<typeof getDb>;

export function registerIpcHandlers(): void {
  const db: DB = getDb();

  // ─── Tracks ────────────────────────────────────────────────────────────────

  ipcMain.handle('tracks:list', (_event, { search, limit = 50, offset = 0 }) => {
    if (search) {
      return db.prepare(
        'SELECT * FROM tracks WHERE title LIKE ? OR artist LIKE ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
      ).all(`%${search}%`, `%${search}%`, limit, offset);
    }
    return db.prepare('SELECT * FROM tracks ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  });

  ipcMain.handle('tracks:get', (_event, id: string) => {
    return db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
  });

  ipcMain.handle('tracks:count', () => {
    return db.prepare('SELECT COUNT(*) as count FROM tracks').get();
  });

  // ─── Playlists ─────────────────────────────────────────────────────────────

  ipcMain.handle('playlists:list', () => {
    return db.prepare('SELECT * FROM playlists ORDER BY updated_at DESC').all();
  });

  ipcMain.handle('playlists:get', (_event, id: string) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
    const tracks = db.prepare(
      `SELECT t.*, pt.position FROM playlist_tracks pt 
       JOIN tracks t ON t.id = pt.track_id 
       WHERE pt.playlist_id = ? ORDER BY pt.position`
    ).all(id);
    return { ...playlist, tracks };
  });

  ipcMain.handle('playlists:create', (_event, { name, description }) => {
    const id = randomUUID();
    db.prepare('INSERT INTO playlists (id, name, description) VALUES (?, ?, ?)').run(id, name, description ?? null);
    return { id, name, description };
  });

  ipcMain.handle('playlists:addTrack', (_event, { playlistId, trackId }) => {
    const max = db.prepare('SELECT MAX(position) as pos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as any;
    const position = (max?.pos ?? -1) + 1;
    db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)').run(playlistId, trackId, position);
  });

  ipcMain.handle('playlists:removeTrack', (_event, { playlistId, trackId }) => {
    db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId);
  });

  // ─── Likes ─────────────────────────────────────────────────────────────────

  ipcMain.handle('likes:list', () => {
    return db.prepare('SELECT t.* FROM likes l JOIN tracks t ON t.id = l.track_id ORDER BY l.liked_at DESC').all();
  });

  ipcMain.handle('likes:toggle', (_event, trackId: string) => {
    const existing = db.prepare('SELECT * FROM likes WHERE track_id = ?').get(trackId);
    if (existing) {
      db.prepare('DELETE FROM likes WHERE track_id = ?').run(trackId);
      return false;
    }
    db.prepare('INSERT INTO likes (track_id) VALUES (?)').run(trackId);
    return true;
  });

  // ─── History ───────────────────────────────────────────────────────────────

  ipcMain.handle('history:add', (_event, { trackId, durationMs, skipped, context }) => {
    const id = randomUUID();
    db.prepare('INSERT INTO listening_history (id, track_id, duration_ms, skipped, context) VALUES (?, ?, ?, ?, ?)').run(id, trackId, durationMs, skipped ? 1 : 0, context ?? null);
  });

  ipcMain.handle('history:list', (_event, { limit = 50 }) => {
    return db.prepare(
      'SELECT h.*, t.title, t.artist, t.cover_url FROM listening_history h JOIN tracks t ON t.id = h.track_id ORDER BY h.started_at DESC LIMIT ?'
    ).all(limit);
  });

  // ─── Settings ──────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', (_event, key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row?.value ?? null;
  });

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  });

  ipcMain.handle('settings:getAll', () => {
    const rows = db.prepare('SELECT * FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    return settings;
  });

  // ─── Connected Services ────────────────────────────────────────────────────

  ipcMain.handle('services:list', () => {
    return db.prepare('SELECT * FROM connected_services').all();
  });

  ipcMain.handle('services:connect', (_event, { connectorId, accessToken, refreshToken, expiresAt }) => {
    const id = randomUUID();
    db.prepare(
      'INSERT OR REPLACE INTO connected_services (id, connector_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, connectorId, accessToken, refreshToken ?? null, expiresAt ?? null);
    return { id, connectorId, status: 'Connected' };
  });

  ipcMain.handle('services:disconnect', (_event, connectorId: string) => {
    db.prepare('DELETE FROM connected_services WHERE connector_id = ?').run(connectorId);
  });

  // ─── Import ────────────────────────────────────────────────────────────────

  ipcMain.handle('import:tracks', (_event, tracks: any[]) => {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO tracks (id, title, artist, album, duration_ms, genre, cover_url, source, external_id, connector_id, isrc, explicit, is_live) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((items: any[]) => {
      for (const t of items) {
        insert.run(
          t.id ?? randomUUID(), t.title, t.artist ?? t.artists?.join(', ') ?? '', t.album ?? null,
          t.durationMs ?? t.duration_ms ?? 0, t.genre ?? null, t.coverUrl ?? t.cover_url ?? null,
          t.source ?? 'import', t.externalId ?? t.external_id ?? null, t.connectorId ?? t.connector_id ?? null,
          t.isrc ?? null, t.explicit ? 1 : 0, t.isLive ? 1 : 0
        );
      }
    });
    insertMany(tracks);
    return { imported: tracks.length };
  });

  // ─── Window controls ───────────────────────────────────────────────────────

  ipcMain.handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize(); else win?.maximize();
  });
  ipcMain.handle('window:close', () => BrowserWindow.getFocusedWindow()?.close());
}
