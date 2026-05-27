import { Injectable, Logger } from '@nestjs/common';

import { AIOrchestrationService } from '../ai-orchestration/ai-orchestration.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Semantic Search Service (Req 8).
 * Accepts natural language queries in RU/EN, converts to vector,
 * performs vector search + fulltext, then AI reranking.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIOrchestrationService,
  ) {}

  /**
   * Semantic search for tracks/artists by natural language query.
   * Combines vector search (pgvector) + PostgreSQL FTS + AI reranking.
   */
  async search(query: string, userId: string, filters?: SearchFilters, limit = 30) {
    // 1. Parse query constraints (genre, mood, BPM, exclusions)
    const parsed = this.parseQuery(query);

    // 2. Get query embedding
    const queryEmbedding = await this.ai.embedText(query);

    // 3. Full-text search (PostgreSQL FTS)
    const ftsResults = await this.fullTextSearch(parsed.cleanQuery, filters, limit);

    // 4. Vector similarity search (simplified — production uses pgvector cosine)
    // In production: SELECT * FROM tracks ORDER BY embedding <=> $1 LIMIT $2
    const vectorResults = ftsResults; // placeholder for vector search

    // 5. Merge and deduplicate
    const merged = this.mergeResults(ftsResults, vectorResults);

    // 6. AI reranking
    if (merged.length > 3) {
      const candidates = merged.map((t: any) => ({
        id: t.id,
        text: `${t.canonicalTitle} - ${t.canonicalArtist?.join(', ')} [${t.genre?.join(', ')}]`,
        score: t._score,
      }));

      const reranked = await this.ai.rerank(query, candidates, limit);
      const rerankedMap = new Map(reranked.map((r) => [r.id, r.score]));

      merged.sort((a: any, b: any) => (rerankedMap.get(b.id) ?? 0) - (rerankedMap.get(a.id) ?? 0));
    }

    return {
      tracks: merged.slice(0, limit),
      query: parsed,
      totalResults: merged.length,
    };
  }

  /**
   * Search suggestions / autocomplete.
   */
  async suggest(query: string, limit = 5) {
    if (query.length < 2) return [];

    const tracks = await this.prisma.track.findMany({
      where: {
        OR: [
          { canonicalTitle: { contains: query, mode: 'insensitive' } },
          { canonicalArtist: { has: query } },
        ],
      },
      take: limit,
      select: { id: true, canonicalTitle: true, canonicalArtist: true, coverUrl: true },
    });

    return tracks.map((t) => ({
      id: t.id,
      title: t.canonicalTitle,
      artist: t.canonicalArtist.join(', '),
      coverUrl: t.coverUrl,
    }));
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private parseQuery(query: string): ParsedQuery {
    let cleanQuery = query;
    const constraints: Record<string, string> = {};

    // Extract exclusions: "без рэпа", "no rap"
    const exclusionPatterns = [
      { pattern: /без\s+(\w+)/gi, key: 'exclude_genre' },
      { pattern: /no\s+(\w+)/gi, key: 'exclude_genre' },
      { pattern: /без вокала|instrumental/gi, key: 'instrumental' },
    ];

    for (const { pattern, key } of exclusionPatterns) {
      const match = query.match(pattern);
      if (match) {
        constraints[key] = match[0];
        cleanQuery = cleanQuery.replace(pattern, '').trim();
      }
    }

    // Extract BPM range
    const bpmMatch = query.match(/(\d+)\s*-?\s*(\d+)?\s*bpm/i);
    if (bpmMatch) {
      constraints.bpm_min = bpmMatch[1]!;
      constraints.bpm_max = bpmMatch[2] ?? bpmMatch[1]!;
      cleanQuery = cleanQuery.replace(bpmMatch[0], '').trim();
    }

    // Extract decade: "2010-х", "2010s"
    const decadeMatch = query.match(/(20\d0)[-х]?s?/);
    if (decadeMatch) {
      constraints.decade = decadeMatch[1]!;
    }

    return { cleanQuery, constraints, originalQuery: query };
  }

  private async fullTextSearch(query: string, filters?: SearchFilters, limit = 30) {
    const where: any = {};

    if (query) {
      where.OR = [
        { canonicalTitle: { contains: query, mode: 'insensitive' } },
        { canonicalArtist: { hasSome: [query] } },
      ];
    }

    if (filters?.genre) {
      where.genre = { has: filters.genre };
    }

    if (filters?.minBpm || filters?.maxBpm) {
      // Would filter on audioFeatures.bpm in production
    }

    return this.prisma.track.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { externalRefs: { select: { connectorId: true, availability: true } } },
    });
  }

  private mergeResults(fts: any[], vector: any[]): any[] {
    const seen = new Set<string>();
    const merged: any[] = [];

    for (const item of [...fts, ...vector]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }

    return merged;
  }
}

interface SearchFilters {
  genre?: string;
  mood?: string;
  minBpm?: number;
  maxBpm?: number;
  language?: string;
  explicit?: boolean;
}

interface ParsedQuery {
  cleanQuery: string;
  constraints: Record<string, string>;
  originalQuery: string;
}
