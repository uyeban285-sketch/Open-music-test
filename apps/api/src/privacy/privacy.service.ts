import { Injectable, Logger } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async enablePrivateMode(userId: string) {
    await this.prisma.privacySetting.upsert({
      where: { userId },
      update: { privateModeDefault: true },
      create: { userId, privateModeDefault: true },
    });
    await this.auditLog.log({
      userId,
      action: 'private_mode_enabled',
      resource: 'privacy_setting',
      resourceId: userId,
    });
  }

  async disablePrivateMode(userId: string) {
    await this.prisma.privacySetting.update({
      where: { userId },
      data: { privateModeDefault: false },
    });
    await this.auditLog.log({
      userId,
      action: 'private_mode_disabled',
      resource: 'privacy_setting',
      resourceId: userId,
    });
  }

  async clearHistory(
    userId: string,
    options?: { period?: { from: Date; to: Date }; trackId?: string },
  ) {
    if (options?.trackId) {
      await this.prisma.listeningEvent.deleteMany({ where: { userId, trackId: options.trackId } });
    } else if (options?.period) {
      await this.prisma.listeningEvent.deleteMany({
        where: { userId, startedAt: { gte: options.period.from, lte: options.period.to } },
      });
    } else {
      await this.prisma.listeningEvent.deleteMany({ where: { userId } });
    }
    await this.auditLog.log({
      userId,
      action: 'history_cleared',
      resource: 'listening_event',
      metadata: options as any,
    });
  }

  async getConsentLog(userId: string) {
    return this.auditLog.getForUser(userId, 50);
  }
}
