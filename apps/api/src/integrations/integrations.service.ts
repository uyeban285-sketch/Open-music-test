import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TokenVaultService } from '../vault/token-vault.service';
import { AuditLogService } from '../audit/audit-log.service';

import { ConnectorRegistryService } from './connector-registry.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistryService,
    private readonly tokenVault: TokenVaultService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listConnections(userId: string) {
    return this.prisma.connectedService.findMany({
      where: { userId },
      orderBy: { connectedAt: 'desc' },
    });
  }

  async startConnect(userId: string, connectorId: string) {
    const connector = this.registry.get(connectorId);

    // Check if file_import (no OAuth needed)
    if (connector.manifest.authMethod === 'file_import') {
      // Create connection directly
      const connection = await this.prisma.connectedService.upsert({
        where: { userId_connectorId: { userId, connectorId } },
        update: { status: 'Connected', disconnectedAt: null },
        create: { userId, connectorId, status: 'Connected' },
      });
      return { connectionId: connection.id, method: 'file_import' };
    }

    // OAuth flow
    const { redirectUrl, state } = await connector.startAuth(userId);
    return { redirectUrl, state };
  }

  async handleCallback(connectorId: string, state: string, params: Record<string, string>) {
    const connector = this.registry.get(connectorId);
    const tokenBundle = await connector.handleCallback(state, params);

    // Extract userId from state (in production, decode the state JWT)
    // For now, we store the token and expect the state to contain userId info
    const userId = this.extractUserIdFromState(state);

    // Create or update connection
    const connection = await this.prisma.connectedService.upsert({
      where: { userId_connectorId: { userId, connectorId } },
      update: { status: 'Connected', disconnectedAt: null, lastError: null },
      create: { userId, connectorId, status: 'Connected' },
    });

    // Store encrypted tokens
    await this.tokenVault.wrap(
      connection.id,
      tokenBundle.accessToken,
      tokenBundle.refreshToken ?? null,
      tokenBundle.expiresAt,
      tokenBundle.scope,
      userId,
    );

    await this.auditLog.log({
      userId,
      action: 'connector_connected',
      resource: 'connected_service',
      resourceId: connection.id,
      metadata: { connectorId },
    });

    return { connectionId: connection.id, status: 'Connected' };
  }

  async reauth(userId: string, connectionId: string) {
    const connection = await this.getConnection(userId, connectionId);
    const connector = this.registry.get(connection.connectorId);
    const { redirectUrl, state } = await connector.startAuth(userId);
    return { redirectUrl, state };
  }

  async disconnect(userId: string, connectionId: string) {
    const connection = await this.getConnection(userId, connectionId);

    // Revoke tokens if they exist
    try {
      await this.tokenVault.revoke(connection.id, userId);
    } catch {
      // Token may not exist, that's OK
    }

    await this.prisma.connectedService.update({
      where: { id: connection.id },
      data: { status: 'Disconnected', disconnectedAt: new Date() },
    });

    await this.auditLog.log({
      userId,
      action: 'connector_disconnected',
      resource: 'connected_service',
      resourceId: connection.id,
      metadata: { connectorId: connection.connectorId },
    });
  }

  async triggerSync(userId: string, connectionId: string, kind: string) {
    const connection = await this.getConnection(userId, connectionId);

    if (connection.status !== 'Connected') {
      throw new BadRequestException(
        `Cannot sync: connection status is ${connection.status}. Please reconnect first.`,
      );
    }

    const job = await this.prisma.syncJob.create({
      data: {
        userId,
        connectorId: connection.connectorId,
        connectedServiceId: connection.id,
        kind: kind as any,
        status: 'queued',
      },
    });

    // In production, enqueue BullMQ job here
    this.logger.log(`Sync job ${job.id} queued for connection ${connectionId}`);

    return job;
  }

  async listSyncJobs(userId: string, connectionId: string) {
    const connection = await this.getConnection(userId, connectionId);
    return this.prisma.syncJob.findMany({
      where: { connectedServiceId: connection.id, userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async getConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.connectedService.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) throw new NotFoundException('Connection not found');
    return connection;
  }

  private extractUserIdFromState(_state: string): string {
    // In production, decode the state JWT to extract userId
    // For now, this is a placeholder
    return '';
  }
}
