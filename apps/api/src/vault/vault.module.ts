import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditLogModule } from '../audit/audit-log.module';

import { KmsClient } from './kms-client.interface';
import { KmsLocalstackClient } from './kms-localstack.client';
import { TokenVaultService } from './token-vault.service';

@Module({
  imports: [AuditLogModule],
  providers: [
    {
      provide: 'KMS_CLIENT',
      useFactory: (config: ConfigService): KmsClient => {
        const backend = config.get<string>('KMS_BACKEND') ?? 'localstack';
        switch (backend) {
          case 'localstack':
          case 'mock':
            return new KmsLocalstackClient(config);
          // Future: case 'aws': return new KmsAwsClient(config);
          // Future: case 'vault': return new KmsVaultClient(config);
          default:
            return new KmsLocalstackClient(config);
        }
      },
      inject: [ConfigService],
    },
    {
      provide: TokenVaultService,
      useFactory: (kms: KmsClient, prisma: any, auditLog: any) => {
        return new TokenVaultService(kms, prisma, auditLog);
      },
      inject: ['KMS_CLIENT', 'PrismaService', 'AuditLogService'],
    },
    TokenVaultService,
  ],
  exports: [TokenVaultService, 'KMS_CLIENT'],
})
export class VaultModule {}
