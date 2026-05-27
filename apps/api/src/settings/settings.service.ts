import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrivacy(userId: string) {
    const settings = await this.prisma.privacySetting.findUnique({ where: { userId } });
    if (!settings) {
      // Create default
      return this.prisma.privacySetting.create({ data: { userId } });
    }
    return settings;
  }

  async updatePrivacy(userId: string, data: Partial<{
    useHistoryForReco: boolean;
    useCloudAi: boolean;
    productAnalyticsEnabled: boolean;
    marketingNotifications: boolean;
    disabledSignalSources: string[];
    privateModeDefault: boolean;
  }>) {
    return this.prisma.privacySetting.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, mfaEnabled: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { email?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, role: true, mfaEnabled: true },
    });
  }
}
