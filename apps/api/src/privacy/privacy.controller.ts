import { Controller, Get, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { DataDeletionService } from './data-deletion.service';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
@UseGuards(JwtAuthGuard)
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly deletion: DataDeletionService,
  ) {}

  @Post('private-mode/enable')
  async enablePrivateMode(@Req() req: any) {
    await this.privacy.enablePrivateMode(req.userId);
    return { status: 'success', message: 'Private mode enabled' };
  }

  @Post('private-mode/disable')
  async disablePrivateMode(@Req() req: any) {
    await this.privacy.disablePrivateMode(req.userId);
    return { status: 'success', message: 'Private mode disabled' };
  }

  @Delete('history')
  async clearHistory(
    @Req() req: any,
    @Body() body?: { from?: string; to?: string; trackId?: string },
  ) {
    const options = body?.trackId
      ? { trackId: body.trackId }
      : body?.from && body?.to
        ? { period: { from: new Date(body.from), to: new Date(body.to) } }
        : undefined;
    await this.privacy.clearHistory(req.userId, options);
    return { status: 'success', message: 'History cleared' };
  }

  @Get('consent-log')
  async getConsentLog(@Req() req: any) {
    const log = await this.privacy.getConsentLog(req.userId);
    return { status: 'success', data: log };
  }

  @Post('data-deletion')
  async requestDeletion(@Req() req: any) {
    const result = await this.deletion.requestDeletion(req.userId);
    return { status: 'success', data: result };
  }

  @Post('data-deletion/cancel')
  async cancelDeletion(@Req() req: any) {
    await this.deletion.cancelDeletion(req.userId);
    return { status: 'success', message: 'Deletion cancelled' };
  }
}
