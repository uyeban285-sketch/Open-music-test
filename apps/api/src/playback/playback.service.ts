import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistryService } from '../integrations/connector-registry.service';

type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering';

@Injectable()
export class PlaybackService {
  private readonly logger = new Logger(PlaybackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistryService,
  ) {}

  async getState(userId: string, deviceId: string) {
    let session = await this.prisma.playbackSession.findFirst({
      where: { userId, deviceId },
    });

    if (!session) {
      session = await this.prisma.playbackSession.create({
        data: { userId, deviceId, queue: [], revision: 0 },
      });
    }

    return session;
  }

  async play(userId: string, deviceId: string, trackId?: string) {
    const session = await this.getOrCreateSession(userId, deviceId);

    const updateData: any = { revision: { increment: 1 } };
    if (trackId) {
      updateData.currentTrackId = trackId;
      updateData.positionMs = 0;
    }

    return this.prisma.playbackSession.update({
      where: { id: session.id },
      data: updateData,
    });
  }

  async pause(userId: string, deviceId: string) {
    const session = await this.getOrCreateSession(userId, deviceId);
    return this.prisma.playbackSession.update({
      where: { id: session.id },
      data: { revision: { increment: 1 } },
    });
  }

  async seek(userId: string, deviceId: string, positionMs: number) {
    const session = await this.getOrCreateSession(userId, deviceId);
    return this.prisma.playbackSession.update({
      where: { id: session.id },
      data: { positionMs, revision: { increment: 1 } },
    });
  }

  async next(userId: string, deviceId: string) {
    const session = await this.getOrCreateSession(userId, deviceId);
    const queue = (session.queue as string[]) ?? [];
    const currentIdx = queue.indexOf(session.currentTrackId ?? '');
    const nextIdx = currentIdx + 1;

    if (nextIdx < queue.length) {
      return this.prisma.playbackSession.update({
        where: { id: session.id },
        data: {
          currentTrackId: queue[nextIdx],
          positionMs: 0,
          revision: { increment: 1 },
        },
      });
    }

    // Handle repeat mode
    if (session.repeatMode === 'all' && queue.length > 0) {
      return this.prisma.playbackSession.update({
        where: { id: session.id },
        data: {
          currentTrackId: queue[0],
          positionMs: 0,
          revision: { increment: 1 },
        },
      });
    }

    return session;
  }

  async prev(userId: string, deviceId: string) {
    const session = await this.getOrCreateSession(userId, deviceId);
    const queue = (session.queue as string[]) ?? [];
    const currentIdx = queue.indexOf(session.currentTrackId ?? '');
    const prevIdx = currentIdx - 1;

    if (prevIdx >= 0) {
      return this.prisma.playbackSession.update({
        where: { id: session.id },
        data: {
          currentTrackId: queue[prevIdx],
          positionMs: 0,
          revision: { increment: 1 },
        },
      });
    }

    return session;
  }

  async updateQueue(userId: string, deviceId: string, queue: string[]) {
    const session = await this.getOrCreateSession(userId, deviceId);
    return this.prisma.playbackSession.update({
      where: { id: session.id },
      data: { queue, revision: { increment: 1 } },
    });
  }

  async setRepeatMode(userId: string, deviceId: string, mode: string) {
    const session = await this.getOrCreateSession(userId, deviceId);
    return this.prisma.playbackSession.update({
      where: { id: session.id },
      data: { repeatMode: mode, revision: { increment: 1 } },
    });
  }

  async setShuffle(userId: string, deviceId: string, shuffle: boolean) {
    const session = await this.getOrCreateSession(userId, deviceId);
    return this.prisma.playbackSession.update({
      where: { id: session.id },
      data: { shuffle, revision: { increment: 1 } },
    });
  }

  /**
   * Resolve playback source for a track (choose best available connector).
   */
  async resolveSource(trackId: string, userId: string) {
    const refs = await this.prisma.trackExternalRef.findMany({
      where: { trackId, availability: 'playable' },
    });

    if (!refs.length) {
      return { directPlayback: false, deepLink: null, sources: [] };
    }

    // Return available sources with deep links
    const sources = refs.map((ref) => {
      const connector = this.registry.has(ref.connectorId) ? this.registry.get(ref.connectorId) : null;
      return {
        connectorId: ref.connectorId,
        externalId: ref.externalId,
        directPlayback: connector?.manifest.capabilities.directPlayback ?? false,
        deepLink: connector?.getDeepLink(ref.externalId) ?? null,
      };
    });

    return { sources, primarySource: sources[0] };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async getOrCreateSession(userId: string, deviceId: string) {
    let session = await this.prisma.playbackSession.findFirst({ where: { userId, deviceId } });
    if (!session) {
      session = await this.prisma.playbackSession.create({
        data: { userId, deviceId, queue: [], revision: 0 },
      });
    }
    return session;
  }
}
