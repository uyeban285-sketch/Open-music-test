import { Module } from '@nestjs/common';

import { AIOrchestrationService } from './ai-orchestration.service';

@Module({
  providers: [AIOrchestrationService],
  exports: [AIOrchestrationService],
})
export class AIOrchestrationModule {}
