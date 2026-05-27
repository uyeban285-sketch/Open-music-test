import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module';
import { MatchingModule } from '../matching/matching.module';

import { QueueConfigService } from './queue-config.service';
import { SyncOrchestratorService } from './sync-orchestrator.service';
import { FullSyncWorker } from './workers/full-sync.worker';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [IntegrationsModule, MatchingModule],
  providers: [QueueConfigService, SyncOrchestratorService, FullSyncWorker, RateLimitService],
  exports: [SyncOrchestratorService, QueueConfigService],
})
export class SyncModule {}
