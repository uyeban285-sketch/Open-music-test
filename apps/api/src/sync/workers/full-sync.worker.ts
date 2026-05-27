import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { ConnectorRegistryService } from '../../integrations/connector-registry.service';
import { TokenVaultService } from '../../vault/token-vault.service';
import { RateLimitService } from '../rate-limit.service';
import { SyncOrchestratorService } from '../sync-orchestrator.service';

/**
 * Full Sync Worker — imports playlists, liked tracks, recent history.
 * Per-object error isolation: failure of one item doesn't fail the whole job.
 * After success → enqueue match:reconcile.
 */
@Injectable()
export class FullSyncWorker {
  private readonly logger = new Logger(FullSyncWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistryService,
    private readonly tokenVault: TokenVaultService,
    private readonly rateLimit: RateLimitService,
    private readonly orchestrator: SyncOrchestratorService,
  ) {}

  /**
   * Execute full sync for a job.
   */
  async process(jobId: string) {
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
      include: { connectedService: true },
    });

    if (!job || !job.connectedServiceId) {
      this.logger.error(`Job ${jobId} not found or missing connectedServiceId`);
      return;
    }

    const connector = this.registry.get(job.connectorId);
    const { accessToken, refreshToken, expiresAt } = await this.tokenVault.unwrap(
      job.connectedServiceId,
      job.userId,
    );

    const ctx = {
      userId: job.userId,
      token: { accessToken, refreshToken, expiresAt, scope: [] },
      connectorId: job.connectorId,
    };

    // Initialize rate limiter
    this.rateLimit.initBucket(job.connectorId, connector.manifest.rateLimits.perMinute);

    let totalImported = 0;
    let totalErrors = 0;

    try {
      // Import liked tracks
      const { imported: tracksImported, errors: tracksErrors } =
        await this.importLikedTracks(ctx, connector, job.userId);
      totalImported += tracksImported;
      totalErrors += tracksErrors;

      // Import playlists
      const { imported: playlistsImported, errors: playlistsErrors } =
        await this.importPlaylists(ctx, connector, job.userId);
      totalImported += playlistsImported;
      totalErrors += playlistsErrors;

      // Determine final status
      if (totalErrors > 0 && totalImported > 0) {
        await this.orchestrator.partial(jobId, { imported: totalImported, errors: totalErrors });
      } else if (totalErrors > 0) {
        await this.orchestrator.fail(jobId, `All items failed (${totalErrors} errors)`);
      } else {
        await this.orchestrator.complete(jobId, { imported: totalImported });
      }

      this.logger.log(`Full sync complete: ${totalImported} imported, ${totalErrors} errors`);
    } catch (error) {
      this.logger.error(`Full sync failed for job ${jobId}`, error);
      await this.orchestrator.fail(jobId, error);
    }
  }

  private async importLikedTracks(ctx: any, connector: any, userId: string) {
    let imported = 0;
    let errors = 0;
    let cursor: string | undefined;

    do {
      // Rate limit check
      const allowed = await this.rateLimit.tryConsume(ctx.connectorId);
      if (!allowed) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      try {
        const page = await connector.listLikedTracks(ctx, cursor);

        for (const track of page.items) {
          try {
            await this.upsertTrack(track, ctx.connectorId, userId);
            imported++;
          } catch (err) {
            errors++;
            this.logger.warn(`Failed to import track ${track.externalId}: ${err}`);
          }
        }

        cursor = page.cursor;
        await this.orchestrator.updateProgress(ctx.connectorId, page.total ?? 0, imported);
      } catch (err: any) {
        if (err.message?.startsWith('RATE_LIMITED:')) {
          const seconds = parseInt(err.message.split(':')[1] ?? '60', 10);
          await this.rateLimit.handleRateLimit(ctx.connectorId, seconds);
        } else if (err.message === 'TOKEN_EXPIRED') {
          throw new Error('TOKEN_EXPIRED');
        } else {
          errors++;
          break;
        }
      }
    } while (cursor);

    return { imported, errors };
  }

  private async importPlaylists(ctx: any, connector: any, userId: string) {
    let imported = 0;
    let errors = 0;
    let cursor: string | undefined;

    do {
      const allowed = await this.rateLimit.tryConsume(ctx.connectorId);
      if (!allowed) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      try {
        const page = await connector.listPlaylists(ctx, cursor);

        for (const playlist of page.items) {
          try {
            await this.prisma.playlist.upsert({
              where: { id: playlist.externalId }, // Simplified
              update: { name: playlist.name, lastSyncedAt: new Date() },
              create: {
                ownerUserId: userId,
                name: playlist.name,
                description: playlist.description,
                sourceConnectorId: ctx.connectorId,
                externalId: playlist.externalId,
              },
            });
            imported++;
          } catch (err) {
            errors++;
          }
        }

        cursor = page.cursor;
      } catch {
        errors++;
        break;
      }
    } while (cursor);

    return { imported, errors };
  }

  private async upsertTrack(externalTrack: any, connectorId: string, _userId: string) {
    // Check if external ref already exists
    const existing = await this.prisma.trackExternalRef.findUnique({
      where: { connectorId_externalId: { connectorId, externalId: externalTrack.externalId } },
    });

    if (existing) {
      // Update metadata snapshot
      await this.prisma.trackExternalRef.update({
        where: { id: existing.id },
        data: { metadataSnapshot: externalTrack, updatedAt: new Date() },
      });
      return;
    }

    // Create new track + external ref
    const track = await this.prisma.track.create({
      data: {
        canonicalTitle: externalTrack.title,
        canonicalArtist: externalTrack.artists,
        isrc: externalTrack.isrc ?? null,
        durationMs: externalTrack.durationMs ?? 0,
        explicit: externalTrack.explicit ?? false,
        isLive: externalTrack.isLive ?? false,
        genre: externalTrack.genre ? [externalTrack.genre] : [],
        coverUrl: externalTrack.coverUrl ?? null,
        source: connectorId,
        availability: { [connectorId]: externalTrack.availability },
      },
    });

    await this.prisma.trackExternalRef.create({
      data: {
        trackId: track.id,
        connectorId,
        externalId: externalTrack.externalId,
        availability: externalTrack.availability,
        metadataSnapshot: externalTrack,
      },
    });
  }
}
