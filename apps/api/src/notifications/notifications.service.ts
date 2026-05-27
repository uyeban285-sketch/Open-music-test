import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { dispatchedAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, seenAt: null } });
  }

  async markSeen(userId: string, ids: string[]) {
    await this.prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { seenAt: new Date() },
    });
  }

  async markAllSeen(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, seenAt: null },
      data: { seenAt: new Date() },
    });
  }

  async create(userId: string, category: any, payload: Record<string, unknown>) {
    return this.prisma.notification.create({ data: { userId, category, payload } });
  }
}
