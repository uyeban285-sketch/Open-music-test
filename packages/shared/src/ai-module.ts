/**
 * AI Module, Recommendation Source, and Analytics module interfaces.
 * Registries for plug-in architecture (Requirements 34.1–34.5).
 */

// ─── AI Module ───────────────────────────────────────────────────────────────

export type AIModuleType = 'embedding' | 'reranker' | 'llm' | 'clustering' | 'feature_extraction';
export type PrivacyClass = 'local_only' | 'cloud_allowed' | 'hybrid';

export interface AIModuleManifest {
  id: string;
  type: AIModuleType;
  displayName: string;
  capabilities: string[];
  io: {
    input: string; // e.g., 'text', 'audio_features', 'track_list'
    output: string; // e.g., 'vector_1024', 'ranked_list', 'text'
  };
  cost: 'free' | 'low' | 'medium' | 'high';
  privacyClass: PrivacyClass;
}

export interface AIModule {
  manifest: AIModuleManifest;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

// ─── Recommendation Source ───────────────────────────────────────────────────

export interface RecoSourceManifest {
  id: string;
  displayName: string;
  type: 'content' | 'collaborative' | 'semantic' | 'local_ai' | 'hybrid';
  weight: number; // default weight in ensemble
  privacyClass: PrivacyClass;
}

export interface RecoSource {
  manifest: RecoSourceManifest;
  generate(userId: string, limit: number): Promise<Array<{ trackId: string; score: number }>>;
}

// ─── Analytics Module ────────────────────────────────────────────────────────

export interface AnalyticsManifest {
  id: string;
  displayName: string;
  metrics: string[];
  refreshInterval: string; // e.g., '1h', '24h'
}

export interface AnalyticsModule {
  manifest: AnalyticsManifest;
  compute(userId: string): Promise<Record<string, unknown>>;
}

// ─── Registries (singletons with lazy-init) ──────────────────────────────────

export class AIModuleRegistry {
  private static instance: AIModuleRegistry;
  private modules = new Map<string, AIModule>();

  private constructor() {}

  static getInstance(): AIModuleRegistry {
    if (!AIModuleRegistry.instance) {
      AIModuleRegistry.instance = new AIModuleRegistry();
    }
    return AIModuleRegistry.instance;
  }

  register(module: AIModule): void {
    if (this.modules.has(module.manifest.id)) {
      throw new Error(`AI module "${module.manifest.id}" already registered`);
    }
    this.modules.set(module.manifest.id, module);
  }

  get(id: string): AIModule {
    const module = this.modules.get(id);
    if (!module) throw new Error(`AI module "${id}" not found`);
    return module;
  }

  list(): AIModuleManifest[] {
    return Array.from(this.modules.values()).map((m) => m.manifest);
  }

  getByType(type: AIModuleType): AIModule[] {
    return Array.from(this.modules.values()).filter((m) => m.manifest.type === type);
  }
}

export class RecoSourceRegistry {
  private static instance: RecoSourceRegistry;
  private sources = new Map<string, RecoSource>();

  private constructor() {}

  static getInstance(): RecoSourceRegistry {
    if (!RecoSourceRegistry.instance) {
      RecoSourceRegistry.instance = new RecoSourceRegistry();
    }
    return RecoSourceRegistry.instance;
  }

  register(source: RecoSource): void {
    if (this.sources.has(source.manifest.id)) {
      throw new Error(`Reco source "${source.manifest.id}" already registered`);
    }
    this.sources.set(source.manifest.id, source);
  }

  get(id: string): RecoSource {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Reco source "${id}" not found`);
    return source;
  }

  list(): RecoSourceManifest[] {
    return Array.from(this.sources.values()).map((s) => s.manifest);
  }
}

export class AnalyticsRegistry {
  private static instance: AnalyticsRegistry;
  private modules = new Map<string, AnalyticsModule>();

  private constructor() {}

  static getInstance(): AnalyticsRegistry {
    if (!AnalyticsRegistry.instance) {
      AnalyticsRegistry.instance = new AnalyticsRegistry();
    }
    return AnalyticsRegistry.instance;
  }

  register(module: AnalyticsModule): void {
    if (this.modules.has(module.manifest.id)) {
      throw new Error(`Analytics module "${module.manifest.id}" already registered`);
    }
    this.modules.set(module.manifest.id, module);
  }

  get(id: string): AnalyticsModule {
    const module = this.modules.get(id);
    if (!module) throw new Error(`Analytics module "${id}" not found`);
    return module;
  }

  list(): AnalyticsManifest[] {
    return Array.from(this.modules.values()).map((m) => m.manifest);
  }
}
