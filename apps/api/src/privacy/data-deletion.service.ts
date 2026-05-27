import { Injectable, Logger } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataDeletionService {
  private readonly logger = new Logger(DataDeletionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async requestDeletion(userId: string): Promise<{ jobId: string; scheduledAt: Date }> {
    const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: scheduledAt } });
    await this.auditLog.log({
      userId,
      action: 'data_deletion_requested',
      resource: 'user',
      resourceId: userId,
      metadata: { scheduledAt: scheduledAt.toISOString() },
    });
    this.logger.log(`Data deletion scheduled for user ${userId} at ${scheduledAt.toISOString()}`);
    return { jobId: userId, scheduledAt };
  }

  async executeDeletion(userId: string): Promise<void> {
    this.logger.log(`Executing data deletion for user ${userId}`);
    await this.prisma.$transaction([
      this.prisma.listeningEvent.deleteMany({ where: { userId } }),
      this.prisma.playbackSession.deleteMany({ where: { userId } }),
      this.prisma.deviceSession.deleteMany({ where: { userId } }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.like.deleteMany({ where: { userId } }),
      this.prisma.syncJob.deleteMany({ where: { userId } }),
      this.prisma.connectedService.deleteMany({ where: { userId } }),
      this.prisma.playlist.deleteMany({ where: { ownerUserId: userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.privacySetting.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    await this.auditLog.log({
      userId,
      action: 'data_deletion_executed',
      resource: 'user',
      resourceId: userId,
    });
    this.logger.log(`Data deletion complete for user ${userId}`);
  }

  async cancelDeletion(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: null } });
    await this.auditLog.log({
      userId,
      action: 'data_deletion_cancelled',
      resource: 'user',
      resourceId: userId,
    });
  }
}
