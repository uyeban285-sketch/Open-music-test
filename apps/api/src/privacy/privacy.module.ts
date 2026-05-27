import { Module } from '@nestjs/common';

import { AuditLogModule } from '../audit/audit-log.module';

import { DataDeletionService } from './data-deletion.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, DataDeletionService],
  exports: [PrivacyService, DataDeletionService],
})
export class PrivacyModule {}
