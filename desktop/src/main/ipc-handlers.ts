import { ipcMain, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { getDb } from './database';

export function registerIpcHandlers(): void {
  const db = getDb();

  ipcMain.handle('tracks:list', (_e, { search, limit = 50, offset = 0 } = {}) =>
    db.tracks.list(search, limit, offset));
  ipcMain.handle('tracks:get', (_e, id: string) => db.tracks.get(id));
  ipcMain.handle('tracks:count', () => db.tracks.count());

  ipcMain.handle('playlists:list', () => db.playlists.list());
  ipcMain.handle('playlists:get', (_e, id: string) => db.playlists.get(id));
  ipcMain.handle('playlists:create', (_e, { name, description }) => {
    const id = randomUUID();
    db.playlists.create(id, name, description);
    return { id, name, description };
  });
  ipcMain.handle('playlists:addTrack', (_e, { playlistId, trackId }) =>
    db.playlists.addTrack(playlistId, trackId));
  ipcMain.handle('playlists:removeTrack', (_e, { playlistId, trackId }) =>
    db.playlists.removeTrack(playlistId, trackId));

  ipcMain.handle('likes:list', () => db.likes.list());
  ipcMain.handle('likes:toggle', (_e, trackId: string) => db.likes.toggle(trackId));

  ipcMain.handle('history:add', (_e, { trackId, durationMs, skipped, context }) =>
    db.history.add({ id: randomUUID(), track_id: trackId, duration_ms: durationMs ?? 0, skipped: skipped ? 1 : 0, context: context ?? null }));
  ipcMain.handle('history:list', (_e, { limit = 50 } = {}) => db.history.list(limit));

  ipcMain.handle('settings:get', (_e, key: string) => db.settings.get(key));
  ipcMain.handle('settings:set', (_e, key: string, value: string) => db.settings.set(key, value));
  ipcMain.handle('settings:getAll', () => db.settings.getAll());

  ipcMain.handle('services:list', () => db.services.list());
  ipcMain.handle('services:connect', (_e, { connectorId, accessToken, refreshToken, expiresAt }) => {
    const id = randomUUID();
    db.services.connect(id, connectorId, accessToken, refreshToken, expiresAt);
    return { id, connectorId, status: 'Connected' };
  });
  ipcMain.handle('services:disconnect', (_e, connectorId: string) =>
    db.services.disconnect(connectorId));

  ipcMain.handle('import:tracks', (_e, tracks: any[]) => {
    const count = db.importTracks(tracks);
    return { imported: count };
  });

  ipcMain.handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.isMaximized() ? win.unmaximize() : win?.maximize();
  });
  ipcMain.handle('window:close', () => BrowserWindow.getFocusedWindow()?.close());
}
