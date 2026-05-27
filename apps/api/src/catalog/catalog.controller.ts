import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CatalogService } from './catalog.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('tracks')
  async listTracks(@Req() req: any, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const tracks = await this.catalog.listTracks(req.userId, cursor, limit ? parseInt(limit) : 50);
    return { status: 'success', data: tracks };
  }

  @Get('tracks/:id')
  async getTrack(@Param('id') id: string) {
    const track = await this.catalog.getTrack(id);
    return { status: 'success', data: track };
  }

  @Get('playlists')
  async listPlaylists(@Req() req: any) {
    const playlists = await this.catalog.listPlaylists(req.userId);
    return { status: 'success', data: playlists };
  }

  @Get('playlists/:id')
  async getPlaylist(@Req() req: any, @Param('id') id: string) {
    const playlist = await this.catalog.getPlaylist(req.userId, id);
    return { status: 'success', data: playlist };
  }

  @Post('playlists')
  async createPlaylist(@Req() req: any, @Body() body: { name: string; description?: string }) {
    const playlist = await this.catalog.createPlaylist(req.userId, body);
    return { status: 'success', data: playlist };
  }

  @Patch('playlists/:id')
  async updatePlaylist(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const playlist = await this.catalog.updatePlaylist(req.userId, id, body);
    return { status: 'success', data: playlist };
  }

  @Post('playlists/:id/tracks')
  async addTrack(@Req() req: any, @Param('id') id: string, @Body() body: { trackId: string }) {
    await this.catalog.addTrackToPlaylist(req.userId, id, body.trackId);
    return { status: 'success', message: 'Track added' };
  }

  @Delete('playlists/:playlistId/tracks/:trackId')
  async removeTrack(@Req() req: any, @Param('playlistId') playlistId: string, @Param('trackId') trackId: string) {
    await this.catalog.removeTrackFromPlaylist(req.userId, playlistId, trackId);
    return { status: 'success', message: 'Track removed' };
  }

  @Get('likes')
  async listLikes(@Req() req: any) {
    const likes = await this.catalog.listLikes(req.userId);
    return { status: 'success', data: likes };
  }

  @Post('likes/:trackId')
  async like(@Req() req: any, @Param('trackId') trackId: string) {
    await this.catalog.likeTrack(req.userId, trackId);
    return { status: 'success', message: 'Liked' };
  }

  @Delete('likes/:trackId')
  async unlike(@Req() req: any, @Param('trackId') trackId: string) {
    await this.catalog.unlikeTrack(req.userId, trackId);
    return { status: 'success', message: 'Unliked' };
  }
}
