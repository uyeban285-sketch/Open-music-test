import { Injectable, Logger } from '@nestjs/common';

/**
 * Rate limit service — Token bucket per connector via Redis.
 * Handles 429 + Retry-After, exponential backoff with jitter for 5xx.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number; maxTokens: number; refillRate: number }>();

  /**
   * Initialize a token bucket for a connector.
   */
  initBucket(connectorId: string, perMinute: number) {
    this.buckets.set(connectorId, {
      tokens: perMinute,
      lastRefill: Date.now(),
      maxTokens: perMinute,
      refillRate: perMinute / 60, // tokens per second
    });
  }

  /**
   * Try to consume a token. Returns true if allowed, false if rate-limited.
   */
  async tryConsume(connectorId: string): Promise<boolean> {
    const bucket = this.buckets.get(connectorId);
    if (!bucket) return true; // No bucket configured — allow

    // Refill tokens
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }

  /**
   * Calculate backoff with jitter for retries.
   */
  getBackoffMs(attempt: number, baseDelay = 1000): number {
    const exponential = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * exponential * 0.1; // 10% jitter
    return Math.min(exponential + jitter, 30000); // max 30s
  }

  /**
   * Handle 429 response — pause until Retry-After.
   */
  async handleRateLimit(connectorId: string, retryAfterSeconds: number): Promise<void> {
    this.logger.warn(`Rate limited for ${connectorId}, waiting ${retryAfterSeconds}s`);
    const bucket = this.buckets.get(connectorId);
    if (bucket) {
      bucket.tokens = 0; // Drain bucket
    }
    await this.sleep(retryAfterSeconds * 1000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
