import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('metrics')
  async metrics(@Req() req: any) {
    this.admin.assertAdmin(req.userRole);
    return { status: 'success', data: await this.admin.getMetrics() };
  }

  @Get('feature-flags')
  async flags(@Req() req: any) {
    this.admin.assertAdmin(req.userRole);
    return { status: 'success', data: await this.admin.listFeatureFlags() };
  }

  @Post('feature-flags')
  async createFlag(@Req() req: any, @Body() body: any) {
    this.admin.assertAdmin(req.userRole);
    return { status: 'success', data: await this.admin.createFeatureFlag(body, req.userId) };
  }

  @Patch('feature-flags/:key')
  async updateFlag(@Req() req: any, @Param('key') key: string, @Body() body: any) {
    this.admin.assertAdmin(req.userRole);
    return { status: 'success', data: await this.admin.updateFeatureFlag(key, body, req.userId) };
  }

  @Get('users')
  async users(@Req() req: any, @Query('page') page?: string) {
    this.admin.assertAdmin(req.userRole);
    return { status: 'success', data: await this.admin.listUsers(page ? parseInt(page) : 1) };
  }

  @Get('connector-health')
  async health(@Req() req: any) {
    this.admin.assertAdmin(req.userRole);
    return { status: 'success', data: await this.admin.getConnectorHealth() };
  }
}
