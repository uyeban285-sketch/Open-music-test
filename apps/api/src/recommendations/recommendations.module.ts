import { Module } from '@nestjs/common';

import { AIOrchestrationModule } from '../ai-orchestration/ai-orchestration.module';

import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [AIOrchestrationModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
