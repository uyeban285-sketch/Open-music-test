import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getSettings(@Req() req: any) {
    const [user, privacy] = await Promise.all([
      this.settings.getUser(req.userId),
      this.settings.getPrivacy(req.userId),
    ]);
    return { status: 'success', data: { user, privacy } };
  }

  @Patch()
  async updateSettings(@Req() req: any, @Body() body: any) {
    const user = await this.settings.updateProfile(req.userId, body);
    return { status: 'success', data: user };
  }

  @Get('privacy')
  async getPrivacy(@Req() req: any) {
    const privacy = await this.settings.getPrivacy(req.userId);
    return { status: 'success', data: privacy };
  }

  @Patch('privacy')
  async updatePrivacy(@Req() req: any, @Body() body: any) {
    const privacy = await this.settings.updatePrivacy(req.userId, body);
    return { status: 'success', data: privacy };
  }
}
