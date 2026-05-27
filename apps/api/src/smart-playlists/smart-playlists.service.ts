import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const SMART_PLAYLIST_TEMPLATES = [
  { key: 'daily', name: 'Ежедневный микс', query: 'daily mix based on recent listening' },
  { key: 'work', name: 'Работа', query: 'instrumental focus music for work concentration' },
  { key: 'commute', name: 'Для дороги', query: 'upbeat energetic music for commute' },
  { key: 'focus', name: 'Фокус', query: 'ambient lo-fi beats for deep focus' },
  { key: 'relax', name: 'Отдых', query: 'calm relaxing chill music' },
  { key: 'sport', name: 'Спорт', query: 'high energy workout music 140+ bpm' },
  { key: 'sleep', name: 'Сон', query: 'soft ambient music for sleep' },
  { key: 'new', name: 'Новинки', query: 'new releases from favorite artists' },
  { key: 'discover', name: 'Открытия', query: 'less familiar more discoveries new artists' },
];

@Injectable()
export class SmartPlaylistsService {
  private readonly logger = new Logger(SmartPlaylistsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async generateAll(userId: string) {
    const results = [];
    for (const template of SMART_PLAYLIST_TEMPLATES) {
      const playlist = await this.prisma.playlist
        .upsert({
          where: { id: `smart-${template.key}-${userId}` },
          update: { lastSyncedAt: new Date() },
          create: {
            id: `smart-${template.key}-${userId}`,
            ownerUserId: userId,
            name: template.name,
            isSmart: true,
            smartConfig: { key: template.key, query: template.query },
          },
        })
        .catch(() => null);
      if (playlist) results.push(playlist);
    }
    return results;
  }

  async getForUser(userId: string) {
    return this.prisma.playlist.findMany({
      where: { ownerUserId: userId, isSmart: true },
      orderBy: { name: 'asc' },
    });
  }

  async pin(userId: string, playlistId: string) {
    await this.prisma.playlist.updateMany({
      where: { id: playlistId, ownerUserId: userId },
      data: { pinned: true },
    });
  }

  async unpin(userId: string, playlistId: string) {
    await this.prisma.playlist.updateMany({
      where: { id: playlistId, ownerUserId: userId },
      data: { pinned: false },
    });
  }
}
