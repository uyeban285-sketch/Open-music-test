/**
 * SQLite database — локальное хранилище всех данных пользователя.
 * Без внешних серверов — всё на компе.
 */
import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';

let db: Database.Database;

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'open-music.db');
  db = new Database(dbPath);

  // WAL mode для производительности
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Создаём таблицы
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      duration_ms INTEGER,
      genre TEXT,
      cover_url TEXT,
      source TEXT NOT NULL,
      external_id TEXT,
      connector_id TEXT,
      isrc TEXT,
      explicit INTEGER DEFAULT 0,
      is_live INTEGER DEFAULT 0,
      bpm REAL,
      energy REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source TEXT,
      external_id TEXT,
      is_smart INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      added_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (playlist_id, position),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      track_id TEXT PRIMARY KEY,
      liked_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS listening_history (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      duration_ms INTEGER,
      skipped INTEGER DEFAULT 0,
      context TEXT,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS connected_services (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'Connected',
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      connected_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      category TEXT NOT NULL,
      score REAL,
      reasons TEXT,
      generated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    -- Индексы
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_source ON tracks(source);
    CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);
    CREATE INDEX IF NOT EXISTS idx_history_track ON listening_history(track_id);
    CREATE INDEX IF NOT EXISTS idx_history_date ON listening_history(started_at);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_category ON recommendations(category);
  `);

  // Дефолтные настройки
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('theme', 'dark');
  insertSetting.run('visualizer_mode', 'bar');
  insertSetting.run('visualizer_intensity', '75');
  insertSetting.run('dynamic_palette', 'true');
  insertSetting.run('local_ai_enabled', 'false');
  insertSetting.run('local_ai_url', 'http://127.0.0.1:11434/v1');
  insertSetting.run('local_ai_model', 'llama3.1:8b-instruct');
}

export function getDb(): Database.Database {
  return db;
}
