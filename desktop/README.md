# Open Music — Desktop App

Десктопное приложение. Собирается в `.exe` инсталлятор (Windows), `.dmg` (Mac), `.AppImage` (Linux).

## Быстрый старт (разработка)

```bash
cd desktop
npm install
npm run dev
```

Откроется окно приложения с hot-reload.

## Сборка инсталлятора

### Windows (.exe)

```bash
npm run package
```

Готовый инсталлятор: `dist-electron/Open Music Setup 0.1.0.exe`

### Mac (.dmg)

```bash
npm run package:mac
```

### Linux (.AppImage)

```bash
npm run package:linux
```

### Все платформы

```bash
npm run package:all
```

## Технологии

- **Electron** — десктопная оболочка
- **React** + **Tailwind CSS** — UI
- **SQLite** (better-sqlite3) — локальная БД, без серверов
- **electron-builder** — сборка инсталляторов
- **electron-vite** — быстрая сборка с HMR

## Структура

```
desktop/
├── src/
│   ├── main/           — Node.js процесс (SQLite, IPC, файлы)
│   │   ├── index.ts    — точка входа Electron
│   │   ├── database.ts — SQLite схема и инициализация
│   │   └── ipc-handlers.ts — API для UI
│   ├── preload/        — безопасный мост main↔renderer
│   │   └── index.ts
│   └── renderer/       — React UI
│       ├── src/
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── index.html
├── resources/          — иконки для инсталлятора
├── package.json        — зависимости + настройки electron-builder
└── electron-vite.config.ts
```

## Данные

Все данные хранятся локально:
- **Windows:** `%APPDATA%/open-music/open-music.db`
- **Mac:** `~/Library/Application Support/open-music/open-music.db`
- **Linux:** `~/.config/open-music/open-music.db`

Нет серверов, нет регистрации, нет интернета (кроме подключения к Yandex/YouTube если хочешь).
