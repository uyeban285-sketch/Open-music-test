import { Module } from '@nestjs/common';

import { CollaborativeService } from './collaborative.service';

@Module({
  providers: [CollaborativeService],
  exports: [CollaborativeService],
})
export class CollaborativeModule {}
