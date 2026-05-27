/**
 * Domain DTO models with Zod schemas for runtime validation.
 * These types are shared between frontend and backend.
 */
import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const UserRole = z.enum(['listener', 'enthusiast', 'power_user', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const SyncJobKind = z.enum([
  'sync_full',
  'sync_incremental',
  'import_file',
  'export_user_data',
  'match_reconcile',
]);
export type SyncJobKind = z.infer<typeof SyncJobKind>;

export const SyncJobStatus = z.enum([
  'queued',
  'running',
  'partial',
  'succeeded',
  'failed',
  'cancelled',
]);
export type SyncJobStatus = z.infer<typeof SyncJobStatus>;

export const MatchStatus = z.enum([
  'auto_merged',
  'probable_pending',
  'confirmed',
  'rejected',
  'reverted',
]);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const RepeatMode = z.enum(['off', 'one', 'all']);
export type RepeatMode = z.infer<typeof RepeatMode>;

export const NotificationCategory = z.enum([
  'new_release',
  'rediscovery',
  'continue_album',
  'sync_error',
  'match_pending',
  'system',
]);
export type NotificationCategory = z.infer<typeof NotificationCategory>;

// ─── Domain Schemas ──────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: UserRole,
  mfaEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const PrivacySettingSchema = z.object({
  userId: z.string().uuid(),
  useHistoryForReco: z.boolean(),
  useCloudAi: z.boolean(),
  productAnalyticsEnabled: z.boolean(),
  marketingNotifications: z.boolean(),
  disabledSignalSources: z.array(z.string()),
  privateModeDefault: z.boolean(),
});
export type PrivacySetting = z.infer<typeof PrivacySettingSchema>;

export const InternalTrackSchema = z.object({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  canonicalArtist: z.array(z.string()),
  canonicalAlbumId: z.string().uuid().nullable(),
  isrc: z.string().nullable(),
  durationMs: z.number().int().positive(),
  explicit: z.boolean(),
  isLive: z.boolean(),
  genre: z.array(z.string()),
  coverUrl: z.string().url().nullable(),
  audioFeatures: z.record(z.unknown()).nullable(),
  availability: z.record(z.string()),
  source: z.string(),
  lastSyncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InternalTrack = z.infer<typeof InternalTrackSchema>;

export const AlbumSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  artist: z.string(),
  coverUrl: z.string().url().nullable(),
  releaseYear: z.number().int().nullable(),
  createdAt: z.string().datetime(),
});
export type Album = z.infer<typeof AlbumSchema>;

export const ArtistSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().url().nullable(),
  genres: z.array(z.string()),
  createdAt: z.string().datetime(),
});
export type Artist = z.infer<typeof ArtistSchema>;

export const PlaylistSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  sourceConnectorId: z.string().nullable(),
  externalId: z.string().nullable(),
  isCollaborative: z.boolean(),
  isSmart: z.boolean(),
  smartConfig: z.record(z.unknown()).nullable(),
  pinned: z.boolean(),
  lastSyncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Playlist = z.infer<typeof PlaylistSchema>;

export const MatchDecisionSchema = z.object({
  id: z.string().uuid(),
  leftExternalRefId: z.string().uuid(),
  rightExternalRefId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  signals: z.record(z.unknown()),
  status: MatchStatus,
  decidedBy: z.enum(['system', 'user']),
  userId: z.string().uuid().nullable(),
  decidedAt: z.string().datetime(),
  revertedAt: z.string().datetime().nullable(),
});
export type MatchDecision = z.infer<typeof MatchDecisionSchema>;

export const ListeningEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  trackId: z.string().uuid(),
  startedAt: z.string().datetime(),
  durationMs: z.number().int(),
  skipped: z.boolean(),
  context: z.record(z.unknown()).nullable(),
  connectorId: z.string(),
  private: z.boolean(),
  deviceId: z.string().uuid(),
});
export type ListeningEvent = z.infer<typeof ListeningEventSchema>;

export const PlaybackSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deviceId: z.string().uuid(),
  currentTrackId: z.string().uuid().nullable(),
  positionMs: z.number().int().min(0),
  queue: z.array(z.string().uuid()),
  repeatMode: RepeatMode,
  shuffle: z.boolean(),
  updatedAt: z.string().datetime(),
  revision: z.number().int(),
});
export type PlaybackSession = z.infer<typeof PlaybackSessionSchema>;

export const SyncJobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  connectorId: z.string(),
  kind: SyncJobKind,
  status: SyncJobStatus,
  progress: z.object({ total: z.number(), done: z.number() }).nullable(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  errorSummary: z.record(z.unknown()).nullable(),
  result: z.record(z.unknown()).nullable(),
});
export type SyncJob = z.infer<typeof SyncJobSchema>;

export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  category: z.string(),
  trackId: z.string().uuid(),
  score: z.number(),
  reasons: z.array(z.record(z.unknown())),
  sources: z.record(z.number()),
  generatedAt: z.string().datetime(),
  servedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const AIProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  genreDistribution: z.record(z.number()),
  moodDistribution: z.record(z.number()),
  bpmHistogram: z.record(z.number()),
  energyHistogram: z.record(z.number()),
  tasteClusters: z.array(z.record(z.unknown())),
  version: z.number().int(),
  computedAt: z.string().datetime(),
});
export type AIProfile = z.infer<typeof AIProfileSchema>;

export const MoodClusterSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  label: z.string(),
  size: z.number().int(),
  sampleTrackIds: z.array(z.string().uuid()),
});
export type MoodCluster = z.infer<typeof MoodClusterSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  category: NotificationCategory,
  payload: z.record(z.unknown()),
  seenAt: z.string().datetime().nullable(),
  dispatchedAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const FeatureFlagSchema = z.object({
  key: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  rolloutPercentage: z.number().int().min(0).max(100),
  audience: z.record(z.unknown()).nullable(),
  updatedAt: z.string().datetime().optional(),
});
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

// ─── API Envelope Types ──────────────────────────────────────────────────────

export const ProblemDetailsSchema = z.object({
  type: z.string().url().optional(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  errors: z.array(z.record(z.unknown())).optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const PageResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    cursor: z.string().nullable(),
    hasMore: z.boolean(),
    total: z.number().int().optional(),
  });

export type PageResponse<T> = {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
  total?: number;
};

export const ApiErrorSchema = z.object({
  status: z.literal('fail').or(z.literal('error')),
  message: z.string(),
  code: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
