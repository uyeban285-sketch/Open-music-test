/**
 * SQLite database — локальное хранилище через sql.js (чистый JS, без нативных зависимостей).
 * Работает сразу без electron-rebuild.
 */
import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

let db: any = null;
let SQL: any = null;
let dbPath: string = '';

export async function initDatabase(): Promise<void> {
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs();

  const userDataPath = app.getPath('userData');
  if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true });

  dbPath = join(userDataPath, 'open-music.db');

  // Загрузить существующую БД или создать новую
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Создаём таблицы
  db.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      duration_ms INTEGER DEFAULT 0,
      genre TEXT,
      cover_url TEXT,
      source TEXT NOT NULL DEFAULT 'import',
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
      PRIMARY KEY (playlist_id, position)
    );

    CREATE TABLE IF NOT EXISTS likes (
      track_id TEXT PRIMARY KEY,
      liked_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listening_history (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      duration_ms INTEGER,
      skipped INTEGER DEFAULT 0,
      context TEXT
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
      generated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Дефолтные настройки
  const defaults = [
    ['theme', 'dark'],
    ['visualizer_mode', 'bar'],
    ['visualizer_intensity', '75'],
    ['dynamic_palette', 'true'],
    ['local_ai_enabled', 'false'],
    ['local_ai_url', 'http://127.0.0.1:11434/v1'],
    ['local_ai_model', 'llama3.1:8b-instruct'],
  ];
  for (const [key, value] of defaults) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  saveDb();
}

export function getDb() {
  return {
    prepare(sql: string) {
      return {
        all(...params: any[]) {
          const stmt = db.prepare(sql);
          if (params.length) stmt.bind(params);
          const results: any[] = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
        get(...params: any[]) {
          const stmt = db.prepare(sql);
          if (params.length) stmt.bind(params);
          const result = stmt.step() ? stmt.getAsObject() : null;
          stmt.free();
          return result;
        },
        run(...params: any[]) {
          db.run(sql, params);
          saveDb();
        },
      };
    },
  };
}

function saveDb(): void {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}
