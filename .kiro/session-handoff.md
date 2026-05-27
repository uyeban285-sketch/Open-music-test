# 📋 Session Handoff — Open Music

> Документ для передачи контекста между сессиями Kiro (десктоп → веб).
> Содержит: полный отчёт о проделанной работе, состояние спеки, ключевые архитектурные решения, инструкцию для запуска в веб-сессии, и стенограмму чата.

---

## TL;DR

- Это **greenfield**-проект `Open Music` — мульти-источниковый музыкальный агрегатор.
- В репозитории сейчас **только спека** (`requirements.md`, `design.md`, `tasks.md`) — никакого кода ещё нет.
- В этой сессии я (оркестратор) поставил задачи в очередь и перевёл первую в `in_progress`, **но никакого кода не написал**.
- После этого `tasks.md` перегенерировался: было 124 задачи → стало **268**, ID изменились (теперь с префиксом `📋`).
- Состояние очереди сбросилось. Нужно **в веб-сессии перечитать tasks.md и запустить заново**.

---

## 1. Что это за проект

**Open Music** — мульти-источниковый музыкальный агрегатор с:
- Едиными библиотекой и плеером поверх внешних сервисов (Яндекс Музыка, YouTube Music на старте)
- AI-рекомендациями (гибридные: content + collaborative + semantic + опциональный Local_AI)
- Премиум-визуализацией: 3 режима эквалайзера (Bar / Circular / Liquid)
- Динамической палитрой UI под обложку текущего трека
- Семантическим поиском по естественному языку (RU/EN)
- Опциональным локальным AI (Ollama/llama.cpp) для приватности

**Локация:** `c:\Users\artem\OneDrive\Documents\GitHub\Open-music`
**Spec-папка:** `.kiro/specs/open-music/`

---

## 2. Текущее состояние spec-файлов

В `.kiro/specs/open-music/` лежат три полностью готовых документа:

| Файл | Размер | Статус |
|---|---|---|
| `requirements.md` | ~2184 строки | Готов. 34 группы требований, EARS-нотация, фазы MVP/Phase 2/3/4 |
| `design.md` | ~667 строк | Готов. C4 диаграммы, tech stack, доменные модули, data model, AI-pipeline |
| `tasks.md` | **268 задач** (regenerated) | Готов. Перегенерировался во время сессии — теперь больше детализации |

⚠️ **Важно:** `tasks.md` обновился с 124 → 268 задач между первым чтением и завершением сессии. В новой версии задачи имеют префикс `📋` и более мелкое разбиение. Перед запуском в вебе **обязательно перечитай tasks.md заново**, чтобы синхронизироваться с текущим деревом.

---

## 3. Что было сделано в этой сессии

**Только оркестрация. Кода нет:**

1. ✅ Прочитал `tasks.md`, `requirements.md`, `design.md` (частично — файлы большие)
2. ✅ Вызвал `task_update status='queued'` без taskId — батч-поставил 105 задач (старая версия дерева) в очередь
3. ✅ Получил исполнительный порядок (executionOrder)
4. ✅ Перевёл задачу `1.1 Инициализировать монорепо (pnpm workspaces) и базовый tooling` в `in_progress`
5. ❌ **Никаких файлов не создавал, никаких команд в shell не выполнял, никаких субагентов не дёргал**

После реconnect: дерево задач перегенерировалось, ID `1.1 Инициализировать монорепо...` больше не существует, вместо него — `1.1 📋 Создать структуру pnpm-workspace и общий tsconfig`. Состояние in_progress сбросилось.

---

## 4. Ключевые архитектурные решения (из design.md)

### 4.1 Tech stack

**Frontend:**
- Next.js 14+ (App Router) + React 18 + TypeScript strict
- Zustand (UI state) + TanStack Query (server state)
- Tailwind CSS + Radix UI primitives + Framer Motion
- Web Audio API (`AnalyserNode`) для эквалайзера
- Canvas 2D (Bar) + WebGL via regl/PixiJS (Circular, Liquid)
- k-means в Web Worker через OffscreenCanvas для Dynamic_Palette
- next-pwa + IndexedDB (через `idb`) для offline
- i18next (RU/EN)

**Backend:**
- Node.js 20 LTS + NestJS (API, REST + WebSocket)
- Python 3.11 + FastAPI (AI-сервисы)
- BullMQ (Redis-backed) для очередей и воркеров
- Socket.IO для realtime (player sync, live recommendations)
- Validation: Zod (Node) / Pydantic v2 (Python)

**Хранилища:**
- PostgreSQL 16 + pgvector (HNSW index, vector(1024))
- Redis 7 (cache, queues, pub-sub)
- S3-совместимое хранилище (MinIO в dev, AWS S3 в prod)
- Расширения Postgres: `pgcrypto`, `citext`, `pg_trgm`, `vector`
- ORM: Prisma (Node) + SQLAlchemy 2 (Python)

**AI:**
- Embeddings (текст RU/EN): `intfloat/multilingual-e5-large` (1024-dim)
- Audio embeddings: CLAP (`laion/CLAP`)
- Reranker: `BAAI/bge-reranker-v2-m3`
- Audio features: librosa (BPM, RMS energy)
- Кластеризация: HDBSCAN
- Local_AI: OpenAI-compatible (Ollama, llama.cpp, LM Studio) — **вызовы идут с frontend напрямую на localhost** (DR-005, приватность)

**DevOps:**
- Docker + docker-compose (dev), Kubernetes (Phase 2+)
- GitHub Actions (CI/CD)
- OpenTelemetry → Grafana + Loki + Tempo + Prometheus
- Sentry (error tracking)
- Doppler / HashiCorp Vault + KMS
- Unleash (feature flags)

### 4.2 Структура монорепо

```
apps/
  web/                    # Next.js 14
  api/                    # NestJS
services/
  ai/                     # FastAPI (каркас под Phase 2)
packages/
  shared/                 # TS-контракты, Zod-схемы
  connectors/
    yandex-music/
    youtube-music/
    file-import/
```

### 4.3 Ключевые контракты (Connector abstraction)

```ts
// MusicConnector — ядро не знает External_Service (Req 1.9, 34.1)
interface MusicConnector {
  manifest: ConnectorManifest;
  // Auth
  startAuth(userId): Promise<{ redirectUrl, state }>;
  handleCallback(state, params): Promise<TokenBundle>;
  refresh(token): Promise<TokenBundle>;
  revoke(token): Promise<void>;
  // Library
  listPlaylists(ctx, cursor?): Promise<Page<ExternalPlaylist>>;
  listLikedTracks(ctx, cursor?): Promise<Page<ExternalTrack>>;
  listRecentlyPlayed(ctx, since?): Promise<ExternalTrack[]>;
  getTrack(ctx, externalId): Promise<ExternalTrack>;
  // Playback (опционально)
  resolvePlayback?(ctx, externalId): Promise<PlaybackHandle>;
  getDeepLink(externalId): string;
  // Lyrics (опционально)
  getLyrics?(ctx, externalId): Promise<Lyrics | null>;
}

class ConnectorRegistry {
  register(c: MusicConnector): void;
  get(id: ConnectorId): MusicConnector;
  list(): ConnectorManifest[];
}
```

### 4.4 Track Matching (Req 3) — критичная логика

- **С ISRC**: совпадение → confidence ≥ 0.9 базово, +0.05 при title+artist
- **Без ISRC**: `0.45·title_jw + 0.30·artist_jaccard + 0.15·duration_sim + 0.10·album_jw`
- **Нормализация**: NFD → удаление диакритики → lowercase → удаление `(...)` `[...]` → `feat./ft./featuring → feat` → удаление пунктуации → схлопывание пробелов
- **Live/Explicit guard**: если `isLive_a !== isLive_b` ИЛИ `explicit_a !== explicit_b` → НЕ объединять, независимо от confidence
- **Auto-merge**: ≥ 0.9
- **Probable_pending**: [0.5, 0.9) — требует ручного подтверждения
- **No-link**: < 0.5
- **Revert**: ≤ 30 дней

### 4.5 Безопасность

- Argon2id (memory=64MB, ops=3) для паролей
- JWT access (15 мин) + opaque refresh (30 дней, rotated, в Redis)
- TOTP MFA опционально, recovery codes
- Envelope-шифрование токенов External_Service: AES-256-GCM + KMS (AWS KMS / mock в dev)
- RLS в Postgres: `tenant_user_id = current_setting('app.user_id')::uuid`
- Audit log: append-only, partitioned by month, retention 12 месяцев

### 4.6 Дополнительные архитектурные решения

- **DR-002**: REST + WebSocket. GraphQL отвергнут.
- **DR-003**: pgvector (HNSW) на старте → Qdrant как drop-in замена при росте.
- **DR-005**: Local_AI вызовы идут с frontend напрямую на localhost, минуя сервер. Сервер получает только финальный результат/вектор. Это соблюдает Req 9.4 (приватность истории).

---

## 5. План работ (high-level — старая версия дерева, 124 задачи)

| # | Фаза | Содержание |
|---|---|---|
| 1 | Setup | Монорепо, tsconfig, ESLint, CI, docker-compose, shared contracts |
| 2 | Database | Prisma schema, миграции, расширения Postgres, RLS |
| 3 | Auth | Регистрация, JWT, MFA TOTP, SSO (Google/Yandex), audit log |
| 4 | Connector Registry | TokenVault, integrations модуль, OAuth flow |
| 5 | Connectors | Yandex Music, YouTube Music, File Import |
| 6 | Matching | Normalize, confidence, live/explicit guard, MatchingService, API |
| 7 | Sync Engine | BullMQ, SyncOrchestrator, full/incremental workers, conflict resolution |
| 8 | Media Catalog API | REST endpoints, Redis cache с инвалидацией |
| 9 | **Checkpoint MVP-1** | Backend готов: register → login → connect Yandex → sync → tracks |
| 10 | Playback Service | State machine, source selection, WebSocket cross-device sync |
| 11 | Settings & Privacy | API + ProblemDetails (RFC 7807) |
| 12 | Frontend Shell | Next.js init, app shell, themes, skeletons, motion |
| 13 | Auth UI | Login/Register, Onboarding, e2e Playwright |
| 14 | Library UI | Virtualized tracks, Track page, Playlists, Match Review, Connected Services |
| 15 | Player UI | Mini, Fullscreen, deep-link fallback, WebSocket client |
| 16 | Equalizer Visualizer | Bar (Canvas 2D), Circular (regl), Liquid (WebGL noise), FPS-monitor + adaptive degrade |
| 17 | Dynamic Palette | k-means в Worker, contrast validator, HSL-коррекция, CSS-переменные |
| 18 | Settings/Privacy UI | |
| 19 | Error Handling & Resilience | Status badges, error toaster, Token_Expired flow, e2e |
| 20 | Observability | OpenTelemetry, Sentry, healthchecks |
| 21 | **Final Checkpoint** | MVP готов к dogfooding |

---

## 6. Что сейчас в репозитории (физически)

```
c:\Users\artem\OneDrive\Documents\GitHub\Open-music\
├── .git/                  (git repo)
├── .gitignore             (открыт в редакторе)
└── .kiro/
    ├── session-handoff.md (этот файл)
    └── specs/
        └── open-music/
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

**Никакого кода ещё нет.** Только спека.

---

## 7. Состояние tasks.md прямо сейчас

```
Total: 268
Completed: 0
Remaining: 268
Ready (can start now): 4
```

**Готовые к запуску прямо сейчас (новое дерево с префиксом 📋):**
1. `1.1 📋 Создать структуру pnpm-workspace и общий tsconfig`
2. `1.2 📋 Настроить ESLint, Prettier, Husky, lint-staged, commitlint`
3. `1.3 📋 Настроить GitHub Actions CI pipeline`
4. `1.4 📋 Настроить pre-commit security gates`

Все четыре независимы — можно запускать параллельно (wave-based scheduling).

---

## 8. Инструкция для веб-сессии — что вставить первым сообщением

```
Run all tasks for this spec:
c:\Users\artem\OneDrive\Documents\GitHub\Open-music\.kiro\specs\open-music\tasks.md

Контекст:
- Это greenfield проект, в репо только spec-файлы (.kiro/specs/open-music/{requirements,design,tasks}.md)
- Никакого кода ещё не написано
- Полный отчёт о предыдущей сессии: c:\Users\artem\OneDrive\Documents\GitHub\Open-music\.kiro\session-handoff.md
- Используй task_list, task_update, invoke_sub_agent (spec-task-execution) согласно DAG
- Перед стартом выполни task_list БЕЗ фильтра, потом task_update status='queued' без taskId для batch-queue
- Дерево задач недавно перегенерировалось — у задач префикс 📋, всего 268 задач
- Запускай ready-задачи параллельно (wave-based scheduling), если их несколько
```

---

## 9. Известные риски

- **R-1 (Yandex Music API)**: публичный API может менять условия. Fallback — `file_import` коннектор с GDPR-экспортом.
- **R-2 (YouTube Music TOS)**: TOS ограничивают коммерческую агрегацию. На MVP — read-only Library + deep-link воспроизведение. Перед публичным запуском требуется юридическое ревью.
- **Длинная сессия в вебе**: 268 задач — это много. Возможно понадобится несколько ран-сессий с компакцией контекста между ними.
- **PBT тесты**: задачи с `*` помечены как опциональные (тестовые). По умолчанию выполняются, но могут быть пропущены для ускорения MVP.
- **Local_AI на сервере**: важно соблюсти DR-005 — Local_AI вызовы идут с frontend, не с backend. Иначе нарушение приватности (Req 9.4).

---

## 10. Стенограмма чата (краткая)

### Сообщение 1 (system) — Spec Workflow Selection

Оркестратор-промпт о том, что я лёгкий dispatcher для выбора workflow.

**Мой ответ:** "I will follow these instructions. Understood."

### Сообщение 2 (system) — Run All Tasks Mode

Получил инструкцию запустить все задачи из спеки. Это перевод в orchestrator mode для DAG-based выполнения.

**Мои действия:**
- `task_list` без фильтра → 124 задачи, 1 ready
- `task_update status='queued'` без taskId → батч-поставил 105 задач, получил executionOrder
- `task_list status='ready'` → одна готовая задача `1.1 Инициализировать монорепо...`
- `task_update status='in_progress'` для неё

### Сообщение 3 (user)

> "стой заверши текущие задачи и сформируй огромный отчёт о проделанной работы и этом чате я запущу тебя в вебе"

**Мои действия:**
- Попытался сбросить `1.1` в `not_started` — ошибка: задача не найдена (дерево уже перегенерировалось)
- `task_list` без фильтра → теперь **268 задач**, 4 ready, ни одной in_progress
- `task_list status='ready'` → новые ID с префиксом `📋`:
  - `1.1 📋 Создать структуру pnpm-workspace и общий tsconfig`
  - `1.2 📋 Настроить ESLint, Prettier, Husky, lint-staged, commitlint`
  - `1.3 📋 Настроить GitHub Actions CI pipeline`
  - `1.4 📋 Настроить pre-commit security gates`

Сформировал отчёт в чате (этот же документ).

### Сообщение 4 (user)

> "нет ты это должен тоже в файл написать"

→ Этот файл, который ты сейчас читаешь.

---

## 11. Полный текст спеки — где искать

| Документ | Путь | Что внутри |
|---|---|---|
| Requirements | `c:\Users\artem\OneDrive\Documents\GitHub\Open-music\.kiro\specs\open-music\requirements.md` | 34 группы требований в EARS-нотации, фазы MVP/Phase 2/3/4 |
| Design | `c:\Users\artem\OneDrive\Documents\GitHub\Open-music\.kiro\specs\open-music\design.md` | C4 диаграммы, tech stack, доменные модули, data model, AI-pipeline, security, risks |
| Tasks | `c:\Users\artem\OneDrive\Documents\GitHub\Open-music\.kiro\specs\open-music\tasks.md` | 268 задач, разбитых на ~21 фазу |

---

## 12. Что НЕ делать в веб-сессии

- ❌ **Не редактировать `requirements.md`, `design.md`, `tasks.md` без явной просьбы пользователя.** Спека утверждена.
- ❌ **Не пропускать чекпоинты (Task 9 и Task 21).** Они существуют, чтобы человек проверил MVP перед продолжением.
- ❌ **Не объединять Live/Explicit треки автоматически** — даже при confidence ≥ 0.9 (Req 3.7).
- ❌ **Не отправлять историю прослушиваний в облако при включённом Private_Mode или Local_AI** (Req 9.4, 21.2).
- ❌ **Не обходить технические ограничения External_Service.** Только официально разрешённые API. При недоступности — `file_import` fallback.

---

## 13. Полезные команды для старта (Windows cmd)

После того как агент в веб-сессии создаст структуру монорепо, эти команды могут пригодиться вручную:

```cmd
:: Установить pnpm (если не установлен)
npm install -g pnpm

:: Установить зависимости монорепо
pnpm install

:: Запустить dev-окружение (Postgres, Redis, MinIO)
docker-compose -f docker-compose.dev.yml up -d

:: Накатить миграции БД
pnpm --filter @open-music/api prisma migrate dev

:: Прогнать все тесты
pnpm test

:: Линт
pnpm lint
```

---

## Приложение A — Краткое содержание requirements.md

34 группы требований, сгруппированы по доменам:

**Группа A. Интеграции (Req 1-3) — MVP:**
1. Подключение External_Service (OAuth, статусы, переподключение, отключение)
2. Импорт и агрегация медиатеки
3. Дедупликация и матчинг треков (детально расписано в разделе 4.4 этого документа)

**Группа B. Библиотека и плеер (Req 4) — MVP:**
4. Воспроизведение и плеер (state machine, очередь, fallback на deep-link, cross-device sync, Mini/Fullscreen)

**Группа C. Визуализация и UI (Req 5-6) — MVP:**
5. Эквалайзер-визуализатор (3 режима, FPS ≥ 30 desktop / ≥ 24 mobile, adaptive degrade)
6. Динамическая палитра (k-means в воркере, WCAG AA/AAA контраст, 300-800ms transition)

**Группа D. AI и рекомендации (Req 7-14) — Phase 2-4:**
7. Рекомендации по истории
8. Семантический поиск (естественный язык RU/EN, vector search + rerank)
9. Local_AI (опциональный, OpenAI-compatible)
10. Объяснимые рекомендации
11. Умные миксы и радио
12. Умные плейлисты
13. Discovery_Mode (Familiarity/Riskiness/Novelty)
14. Настраиваемые фильтры

**Группа E. Аналитика вкуса (Req 15-16) — Phase 4:**
15. Music_Mirror
16. History_Graph

**Группа F. Социальное (Req 17-19) — Phase 3-4:**
17. Collaborative_Playlist
18. Умные напоминания (rediscovery, continue-album)
19. Скрытие дубликатов в UI

**Группа G. Импорт/экспорт и режимы (Req 20-22) — MVP+:**
20. Экспорт пользовательских данных (GDPR/152-ФЗ)
21. Private_Mode
22. Offline-режим

**Группа H. UI/UX и a11y (Req 23-24) — MVP:**
23. UI-стандарты (Skeleton, motion 100-400ms, density Compact/Expanded)
24. Accessibility (WCAG AA, keyboard, contrast shield поверх визуализации)

**Группа I. Платформа (Req 25-28):**
25. Sync_Job lifecycle и конфликт-резолюция
26. Rate-limit, retry, backoff, ProblemDetails
27. Продуктовая аналитика
28. Feature flags + админ-панель (Phase 4)

**Группа J. NFR (Req 29-34):**
29. Производительность (LCP ≤ 2.5s, кеш 5 мин)
30. Масштабируемость
31. Graceful degradation
32. Безопасность (argon2id, MFA, RLS, envelope-шифрование, audit_log 12 мес)
33. Приватность (опт-аут, удаление за 30 дней)
34. Connector-абстракция (плагин-стиль, ядро не знает имён сервисов)

---

## Приложение B — Краткое содержание design.md

**Структура документа:**
1. Overview (3 несущих идеи: Connector-абстракция, гибридный AI, layered domain backend)
2. Tech Stack (фронт, бэк, хранилища, AI, DevOps)
3. Architecture
   - System Context (C4 Level 1)
   - Container Diagram (C4 Level 2)
   - Слои и принципы взаимодействия
4. Components and Interfaces
   - Доменные модули backend (auth, user_profile, media_catalog, playlist_sync, recommendations, search, ai_orchestration, events, playback, settings, admin)
   - Connector-абстракция (Yandex, YouTube, File Import)
   - AI Orchestration (с роутингом по Privacy_Mode)
   - Local_AI Connector (OpenAI-compatible протокол)
   - Sync Workers
   - Notification Service
5. Data Models (User, ConnectedService, ExternalAccount, Track, Artist, Album, TrackExternalRef, MatchDecision, Playlist, PlaylistTrack, ListeningEvent, Like, Recommendation, SearchQuery, AIProfile, MoodCluster, PlaybackSession, SyncJob, Notification, UserSetting/PrivacySetting)
6. Дальше в файле (не читал в сессии): API contracts, Matching pipeline detail, Sync engine detail, AI pipeline detail, Player state machine, Equalizer Visualizer detail, Dynamic Palette detail, Security, Privacy, PBT correctness properties, Risks

---

_Документ создан автоматически при завершении desktop-сессии Kiro для передачи контекста в веб-сессию._
_Дата создания: 26 мая 2026._
