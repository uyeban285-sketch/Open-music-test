import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConnectorManifest, MusicConnector, ConnectorId } from '@open-music/shared';

/**
 * NestJS-integrated ConnectorRegistry.
 * Registers all built-in connectors on app bootstrap.
 */
@Injectable()
export class ConnectorRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConnectorRegistryService.name);
  private readonly connectors = new Map<ConnectorId, MusicConnector>();

  onModuleInit() {
    this.logger.log(`ConnectorRegistry initialized with ${this.connectors.size} connectors`);
  }

  register(connector: MusicConnector): void {
    if (this.connectors.has(connector.manifest.id)) {
      throw new Error(`Connector "${connector.manifest.id}" already registered`);
    }
    this.connectors.set(connector.manifest.id, connector);
    this.logger.log(`Registered connector: ${connector.manifest.displayName} (${connector.manifest.id})`);
  }

  get(id: ConnectorId): MusicConnector {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connector "${id}" not found in registry`);
    }
    return connector;
  }

  list(): ConnectorManifest[] {
    return Array.from(this.connectors.values()).map((c) => c.manifest);
  }

  has(id: ConnectorId): boolean {
    return this.connectors.has(id);
  }

  getAll(): MusicConnector[] {
    return Array.from(this.connectors.values());
  }
}
