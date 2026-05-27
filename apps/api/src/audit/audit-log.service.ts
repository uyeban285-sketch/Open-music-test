import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * AuditLogService — append-only logging for security-critical events.
 * Events: login success/fail, MFA, token issue/revoke, data export/deletion,
 * cross-tenant attempts, token unwrap.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a security/audit event. This is append-only and never deleted.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (error) {
      // Audit logging failure should not break the main operation,
      // but must be reported
      this.logger.error(`Failed to write audit log: ${JSON.stringify(entry)}`, error);
    }
  }

  /**
   * Batch log multiple events (for bulk operations).
   */
  async logBatch(entries: AuditEntry[]): Promise<void> {
    try {
      await this.prisma.auditLog.createMany({
        data: entries.map((entry) => ({
          userId: entry.userId ?? null,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
        })),
      });
    } catch (error) {
      this.logger.error(`Failed to write batch audit log (${entries.length} entries)`, error);
    }
  }

  /**
   * Query audit logs for a user (admin use).
   */
  async getForUser(userId: string, limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Query audit logs by action type.
   */
  async getByAction(action: string, limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
