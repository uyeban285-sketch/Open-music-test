import { Injectable, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const [userCount, trackCount, playlistCount, syncJobCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.track.count(),
      this.prisma.playlist.count(),
      this.prisma.syncJob.count(),
    ]);
    return { userCount, trackCount, playlistCount, syncJobCount };
  }

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async createFeatureFlag(
    data: { key: string; description: string; enabled: boolean; rolloutPercentage: number },
    adminId: string,
  ) {
    return this.prisma.featureFlag.create({ data: { ...data, updatedByAdminId: adminId } });
  }

  async updateFeatureFlag(
    key: string,
    data: { enabled?: boolean; rolloutPercentage?: number },
    adminId: string,
  ) {
    return this.prisma.featureFlag.update({
      where: { key },
      data: { ...data, updatedByAdminId: adminId },
    });
  }

  async listUsers(page = 1, perPage = 50) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, mfaEnabled: true, createdAt: true },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total, page, perPage };
  }

  async getConnectorHealth() {
    return this.prisma.connectedService.groupBy({ by: ['connectorId', 'status'], _count: true });
  }

  assertAdmin(role: string) {
    if (role !== 'admin') throw new ForbiddenException('Admin access required');
  }
}
