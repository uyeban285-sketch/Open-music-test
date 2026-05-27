import { Controller, Get, Post, Put, Body, Req, Headers, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { PlaybackService } from './playback.service';

@Controller('playback')
@UseGuards(JwtAuthGuard)
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @Get('state')
  async getState(@Req() req: any, @Headers('x-device-id') deviceId: string) {
    const state = await this.playback.getState(req.userId, deviceId ?? 'default');
    return { status: 'success', data: state };
  }

  @Post('play')
  async play(@Req() req: any, @Headers('x-device-id') deviceId: string, @Body() body?: { trackId?: string }) {
    const state = await this.playback.play(req.userId, deviceId ?? 'default', body?.trackId);
    return { status: 'success', data: state };
  }

  @Post('pause')
  async pause(@Req() req: any, @Headers('x-device-id') deviceId: string) {
    const state = await this.playback.pause(req.userId, deviceId ?? 'default');
    return { status: 'success', data: state };
  }

  @Post('seek')
  async seek(@Req() req: any, @Headers('x-device-id') deviceId: string, @Body() body: { positionMs: number }) {
    const state = await this.playback.seek(req.userId, deviceId ?? 'default', body.positionMs);
    return { status: 'success', data: state };
  }

  @Post('next')
  async next(@Req() req: any, @Headers('x-device-id') deviceId: string) {
    const state = await this.playback.next(req.userId, deviceId ?? 'default');
    return { status: 'success', data: state };
  }

  @Post('prev')
  async prev(@Req() req: any, @Headers('x-device-id') deviceId: string) {
    const state = await this.playback.prev(req.userId, deviceId ?? 'default');
    return { status: 'success', data: state };
  }

  @Put('queue')
  async updateQueue(@Req() req: any, @Headers('x-device-id') deviceId: string, @Body() body: { queue: string[] }) {
    const state = await this.playback.updateQueue(req.userId, deviceId ?? 'default', body.queue);
    return { status: 'success', data: state };
  }

  @Post('queue/reorder')
  async reorderQueue(@Req() req: any, @Headers('x-device-id') deviceId: string, @Body() body: { queue: string[] }) {
    const state = await this.playback.updateQueue(req.userId, deviceId ?? 'default', body.queue);
    return { status: 'success', data: state };
  }
}
