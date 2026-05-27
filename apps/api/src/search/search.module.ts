import { Module } from '@nestjs/common';

import { AIOrchestrationModule } from '../ai-orchestration/ai-orchestration.module';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AIOrchestrationModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
