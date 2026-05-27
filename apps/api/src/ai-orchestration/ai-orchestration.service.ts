import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AIOrchestrator — central facade for all AI capabilities.
 * Routes between cloud AI, embedding service, Local_AI based on privacy settings.
 */
@Injectable()
export class AIOrchestrationService {
  private readonly logger = new Logger(AIOrchestrationService.name);
  private readonly embeddingUrl: string;
  private readonly rankingUrl: string;
  private readonly profilerUrl: string;

  constructor(private readonly config: ConfigService) {
    this.embeddingUrl = this.config.get<string>('AI_EMBEDDING_URL') ?? 'http://localhost:8001';
    this.rankingUrl = this.config.get<string>('AI_RANKING_URL') ?? 'http://localhost:8002';
    this.profilerUrl = this.config.get<string>('AI_PROFILER_URL') ?? 'http://localhost:8003';
  }

  async embedText(text: string, prefix = 'query: '): Promise<number[]> {
    try {
      const res = await fetch(`${this.embeddingUrl}/embed/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, prefix }),
      });
      if (!res.ok) throw new Error(`Embedding service error: ${res.status}`);
      const data = await res.json();
      return data.embedding;
    } catch (err) {
      this.logger.warn(`Embedding failed, using zero vector: ${err}`);
      return new Array(1024).fill(0);
    }
  }

  async embedTrack(
    title: string,
    artists: string[],
    album?: string,
    genre?: string,
  ): Promise<number[]> {
    try {
      const res = await fetch(`${this.embeddingUrl}/embed/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artists, album, genre }),
      });
      if (!res.ok) throw new Error(`Embedding service error: ${res.status}`);
      const data = await res.json();
      return data.embedding;
    } catch (err) {
      this.logger.warn(`Track embedding failed: ${err}`);
      return new Array(1024).fill(0);
    }
  }

  async embedBatch(texts: string[], prefix = 'passage: '): Promise<number[][]> {
    try {
      const res = await fetch(`${this.embeddingUrl}/embed/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, prefix }),
      });
      if (!res.ok) throw new Error(`Batch embedding error: ${res.status}`);
      const data = await res.json();
      return data.embeddings;
    } catch (err) {
      this.logger.warn(`Batch embedding failed: ${err}`);
      return texts.map(() => new Array(1024).fill(0));
    }
  }

  async rerank(
    query: string,
    candidates: Array<{ id: string; text: string; score?: number }>,
    topK = 20,
  ): Promise<Array<{ id: string; score: number }>> {
    try {
      const res = await fetch(`${this.rankingUrl}/rerank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, candidates, top_k: topK }),
      });
      if (!res.ok) throw new Error(`Ranking service error: ${res.status}`);
      const data = await res.json();
      return data.results;
    } catch (err) {
      this.logger.warn(`Reranking failed, returning original order: ${err}`);
      return candidates.map((c) => ({ id: c.id, score: c.score ?? 0 }));
    }
  }

  async computeProfile(
    userId: string,
    trackEmbeddings: number[][],
    trackGenres: string[][],
    listeningCounts: number[],
  ) {
    try {
      const res = await fetch(`${this.profilerUrl}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          track_embeddings: trackEmbeddings,
          track_genres: trackGenres,
          listening_counts: listeningCounts,
        }),
      });
      if (!res.ok) throw new Error(`Profiler error: ${res.status}`);
      return await res.json();
    } catch (err) {
      this.logger.warn(`Profile computation failed: ${err}`);
      return null;
    }
  }
}
