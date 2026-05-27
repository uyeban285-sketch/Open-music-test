import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollaborativeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: { name: string; description?: string }) {
    return this.prisma.playlist.create({
      data: {
        ownerUserId: userId,
        name: data.name,
        description: data.description,
        isCollaborative: true,
      },
    });
  }

  async addTrack(userId: string, playlistId: string, trackId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId, isCollaborative: true },
    });
    if (!playlist) throw new BadRequestException('Collaborative playlist not found');
    const maxPos = await this.prisma.playlistTrack.aggregate({
      where: { playlistId },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    return this.prisma.playlistTrack.create({
      data: {
        playlistId,
        trackId,
        position,
        addedByUserId: userId,
        origin: { addedBy: userId, type: 'manual' },
      },
    });
  }

  async removeTrack(userId: string, playlistId: string, trackId: string) {
    const entry = await this.prisma.playlistTrack.findFirst({ where: { playlistId, trackId } });
    if (!entry) throw new BadRequestException('Track not in playlist');
    // Only owner of track or playlist owner can remove
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (entry.addedByUserId !== userId && playlist?.ownerUserId !== userId) {
      throw new BadRequestException('Can only remove your own tracks');
    }
    await this.prisma.playlistTrack.delete({
      where: { playlistId_position: { playlistId, position: entry.position } },
    });
  }

  async getCollaborativePlaylists(userId: string) {
    return this.prisma.playlist.findMany({
      where: { isCollaborative: true },
      include: { tracks: { take: 5, include: { track: true } } },
    });
  }
}
