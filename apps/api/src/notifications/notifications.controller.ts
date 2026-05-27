import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@Req() req: any) {
    return { status: 'success', data: await this.notifications.list(req.userId) };
  }

  @Get('unread-count')
  async unread(@Req() req: any) {
    return { status: 'success', data: { count: await this.notifications.unreadCount(req.userId) } };
  }

  @Post('mark-seen')
  async markSeen(@Req() req: any, @Body() body: { ids: string[] }) {
    await this.notifications.markSeen(req.userId, body.ids);
    return { status: 'success' };
  }

  @Post('mark-all-seen')
  async markAll(@Req() req: any) {
    await this.notifications.markAllSeen(req.userId);
    return { status: 'success' };
  }
}
