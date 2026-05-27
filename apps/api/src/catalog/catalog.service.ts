import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listTracks(userId: string, cursor?: string, limit = 50) {
    return this.prisma.track.findMany({
      where: {
        externalRefs: { some: {} }, // Only tracks with at least one external ref
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: { externalRefs: { select: { connectorId: true, externalId: true, availability: true } } },
    });
  }

  async getTrack(trackId: string) {
    const track = await this.prisma.track.findUnique({
      where: { id: trackId },
      include: { externalRefs: true, canonicalAlbum: true },
    });
    if (!track) throw new NotFoundException('Track not found');
    return track;
  }

  async listPlaylists(userId: string) {
    return this.prisma.playlist.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPlaylist(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId, ownerUserId: userId },
      include: { tracks: { include: { track: true }, orderBy: { position: 'asc' } } },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  async createPlaylist(userId: string, data: { name: string; description?: string }) {
    return this.prisma.playlist.create({
      data: { ownerUserId: userId, name: data.name, description: data.description },
    });
  }

  async updatePlaylist(userId: string, playlistId: string, data: { name?: string; description?: string }) {
    const playlist = await this.prisma.playlist.findFirst({ where: { id: playlistId, ownerUserId: userId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return this.prisma.playlist.update({ where: { id: playlistId }, data });
  }

  async addTrackToPlaylist(userId: string, playlistId: string, trackId: string) {
    const playlist = await this.prisma.playlist.findFirst({ where: { id: playlistId, ownerUserId: userId } });
    if (!playlist) throw new NotFoundException('Playlist not found');

    const maxPosition = await this.prisma.playlistTrack.aggregate({
      where: { playlistId },
      _max: { position: true },
    });
    const position = (maxPosition._max.position ?? -1) + 1;

    return this.prisma.playlistTrack.create({
      data: { playlistId, trackId, position, addedByUserId: userId },
    });
  }

  async removeTrackFromPlaylist(userId: string, playlistId: string, trackId: string) {
    const playlist = await this.prisma.playlist.findFirst({ where: { id: playlistId, ownerUserId: userId } });
    if (!playlist) throw new NotFoundException('Playlist not found');

    const entry = await this.prisma.playlistTrack.findFirst({ where: { playlistId, trackId } });
    if (!entry) throw new NotFoundException('Track not in playlist');

    await this.prisma.playlistTrack.delete({ where: { playlistId_position: { playlistId, position: entry.position } } });
  }

  async listLikes(userId: string) {
    return this.prisma.like.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { likedAt: 'desc' },
    });
  }

  async likeTrack(userId: string, trackId: string) {
    return this.prisma.like.upsert({
      where: { userId_trackId: { userId, trackId } },
      update: {},
      create: { userId, trackId },
    });
  }

  async unlikeTrack(userId: string, trackId: string) {
    await this.prisma.like.deleteMany({ where: { userId, trackId } });
  }
}
