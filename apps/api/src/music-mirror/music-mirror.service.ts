import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

@Injectable()
export class MusicMirrorService {
  private readonly logger = new Logger(MusicMirrorService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getMirror(userId: string, period: Period = '30d') {
    const since = this.periodToDate(period);
    const events = await this.prisma.listeningEvent.findMany({
      where: { userId, private: false, startedAt: { gte: since } },
      include: { track: { select: { canonicalTitle: true, canonicalArtist: true, genre: true } } },
      orderBy: { startedAt: 'desc' },
      take: 5000,
    });

    // Compute aggregates
    const genreCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};
    let totalDuration = 0;

    for (const e of events) {
      totalDuration += e.durationMs;
      const hour = e.startedAt.getHours();
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      for (const g of e.track.genre) {
        genreCounts[g] = (genreCounts[g] ?? 0) + 1;
      }
      for (const a of e.track.canonicalArtist) {
        artistCounts[a] = (artistCounts[a] ?? 0) + 1;
      }
    }

    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    const topArtists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    const favoriteHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '20';

    return {
      period,
      totalTracks: events.length,
      totalDurationMs: totalDuration,
      topGenres,
      topArtists,
      favoriteHour: parseInt(favoriteHour),
      sessionsCount: new Set(events.map((e) => e.startedAt.toDateString())).size,
    };
  }

  private periodToDate(period: Period): Date {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      case 'all':
        return new Date(0);
    }
  }
}
