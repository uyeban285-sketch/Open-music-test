import { Controller, Get, Post, Delete, Param, Req, UseGuards, Body, Query } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ConnectorRegistryService } from './connector-registry.service';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly registry: ConnectorRegistryService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /** List all available connector manifests */
  @Get('connectors')
  listConnectors() {
    return { status: 'success', data: this.registry.list() };
  }

  /** List user's connected services */
  @Get('connections')
  async listConnections(@Req() req: any) {
    const connections = await this.integrationsService.listConnections(req.userId);
    return { status: 'success', data: connections };
  }

  /** Start OAuth flow to connect an external service */
  @Post('connect/:connectorId')
  async startConnect(@Req() req: any, @Param('connectorId') connectorId: string) {
    const result = await this.integrationsService.startConnect(req.userId, connectorId);
    return { status: 'success', data: result };
  }

  /** OAuth callback (typically GET, but handled via redirect) */
  @Get('connect/:connectorId/callback')
  async handleCallback(
    @Param('connectorId') connectorId: string,
    @Query('state') state: string,
    @Query('code') code: string,
  ) {
    const result = await this.integrationsService.handleCallback(connectorId, state, { code });
    return { status: 'success', data: result };
  }

  /** Re-authenticate an existing connection */
  @Post('connections/:id/reauth')
  async reauth(@Req() req: any, @Param('id') connectionId: string) {
    const result = await this.integrationsService.reauth(req.userId, connectionId);
    return { status: 'success', data: result };
  }

  /** Disconnect (remove) a connected service */
  @Delete('connections/:id')
  async disconnect(@Req() req: any, @Param('id') connectionId: string) {
    await this.integrationsService.disconnect(req.userId, connectionId);
    return { status: 'success', message: 'Disconnected' };
  }

  /** Trigger manual sync for a connection */
  @Post('connections/:id/sync')
  async triggerSync(@Req() req: any, @Param('id') connectionId: string, @Body() body: any) {
    const job = await this.integrationsService.triggerSync(req.userId, connectionId, body?.kind ?? 'sync_full');
    return { status: 'success', data: job };
  }

  /** List sync jobs for a connection */
  @Get('connections/:id/sync-jobs')
  async listSyncJobs(@Req() req: any, @Param('id') connectionId: string) {
    const jobs = await this.integrationsService.listSyncJobs(req.userId, connectionId);
    return { status: 'success', data: jobs };
  }
}
