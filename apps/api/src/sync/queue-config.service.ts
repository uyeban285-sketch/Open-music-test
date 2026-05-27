import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * BullMQ queue configuration.
 * Queues: sync:full:<connector>, sync:incremental:<connector>, match:reconcile, notify:user
 * Global options: attempts: 3, backoff: exponential 1000ms
 */
@Injectable()
export class QueueConfigService {
  private readonly logger = new Logger(QueueConfigService.name);

  readonly redisConnection: { host: string; port: number };
  readonly defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: { age: 30 * 24 * 60 * 60 }, // 30 days TTL
    removeOnFail: { age: 30 * 24 * 60 * 60 },
  };

  readonly queues = [
    'sync:full:yandex_music',
    'sync:full:youtube_music',
    'sync:full:file_import',
    'sync:incremental:yandex_music',
    'sync:incremental:youtube_music',
    'match:reconcile',
    'notify:user',
  ];

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const url = new URL(redisUrl);
    this.redisConnection = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
    };

    this.logger.log(`Queue config initialized — Redis: ${url.hostname}:${url.port}`);
  }
}
