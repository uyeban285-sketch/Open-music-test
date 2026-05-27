import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AIOrchestrationModule } from './ai-orchestration/ai-orchestration.module';
import { AuditLogModule } from './audit/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { envSchema } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MatchingModule } from './matching/matching.module';
import { RlsMiddlewareModule } from './middleware/rls.module';
import { PlaybackModule } from './playback/playback.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { SyncModule } from './sync/sync.module';
import { VaultModule } from './vault/vault.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    PrismaModule,
    RlsMiddlewareModule,
    AuditLogModule,
    VaultModule,
    HealthModule,
    AuthModule,
    IntegrationsModule,
    CatalogModule,
    MatchingModule,
    SyncModule,
    PlaybackModule,
    SettingsModule,
    // Phase 2: AI & Recommendations
    AIOrchestrationModule,
    RecommendationsModule,
    SearchModule,
  ],
})
export class AppModule {}
