import { Module } from '@nestjs/common';

import { AuditLogModule } from '../audit/audit-log.module';
import { VaultModule } from '../vault/vault.module';

import { ConnectorRegistryService } from './connector-registry.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [AuditLogModule, VaultModule],
  controllers: [IntegrationsController],
  providers: [ConnectorRegistryService, IntegrationsService],
  exports: [ConnectorRegistryService, IntegrationsService],
})
export class IntegrationsModule {}
