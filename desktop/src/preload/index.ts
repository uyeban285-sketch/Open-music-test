/**
 * Preload script — безопасный мост между main и renderer.
 * Экспозит только нужные API через contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Tracks
  listTracks: (params?: { search?: string; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('tracks:list', params ?? {}),
  getTrack: (id: string) => ipcRenderer.invoke('tracks:get', id),
  getTrackCount: () => ipcRenderer.invoke('tracks:count'),

  // Playlists
  listPlaylists: () => ipcRenderer.invoke('playlists:list'),
  getPlaylist: (id: string) => ipcRenderer.invoke('playlists:get', id),
  createPlaylist: (data: { name: string; description?: string }) => ipcRenderer.invoke('playlists:create', data),
  addTrackToPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke('playlists:addTrack', { playlistId, trackId }),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke('playlists:removeTrack', { playlistId, trackId }),

  // Likes
  listLikes: () => ipcRenderer.invoke('likes:list'),
  toggleLike: (trackId: string) => ipcRenderer.invoke('likes:toggle', trackId),

  // History
  addHistory: (data: { trackId: string; durationMs: number; skipped?: boolean; context?: string }) =>
    ipcRenderer.invoke('history:add', data),
  listHistory: (limit?: number) => ipcRenderer.invoke('history:list', { limit: limit ?? 50 }),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),

  // Connected Services
  listServices: () => ipcRenderer.invoke('services:list'),
  connectService: (data: { connectorId: string; accessToken: string; refreshToken?: string; expiresAt?: string }) =>
    ipcRenderer.invoke('services:connect', data),
  disconnectService: (connectorId: string) => ipcRenderer.invoke('services:disconnect', connectorId),

  // Import
  importTracks: (tracks: any[]) => ipcRenderer.invoke('import:tracks', tracks),

  // Window
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
};

contextBridge.exposeInMainWorld('openMusic', api);

export type OpenMusicAPI = typeof api;
