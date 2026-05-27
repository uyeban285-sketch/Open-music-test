import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * SyncOrchestrator — creates sync jobs, tracks progress, manages lifecycle.
 * In production, this would enqueue BullMQ jobs.
 */
@Injectable()
export class SyncOrchestratorService {
  private readonly logger = new Logger(SyncOrchestratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create and enqueue a sync job.
   */
  async createJob(params: {
    userId: string;
    connectorId: string;
    connectedServiceId: string;
    kind: string;
  }) {
    const job = await this.prisma.syncJob.create({
      data: {
        userId: params.userId,
        connectorId: params.connectorId,
        connectedServiceId: params.connectedServiceId,
        kind: params.kind as any,
        status: 'queued',
      },
    });

    this.logger.log(`Created sync job ${job.id}: ${params.kind} for ${params.connectorId}`);

    // In production: enqueue to BullMQ
    // await this.queue.add(`sync:${params.kind}:${params.connectorId}`, { jobId: job.id });

    return job;
  }

  /**
   * Update job progress (called by workers).
   */
  async updateProgress(jobId: string, total: number, done: number) {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date(),
        progress: { total, done },
      },
    });
  }

  /**
   * Mark job as completed.
   */
  async complete(jobId: string, result?: Record<string, unknown>) {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        result: result ?? null,
      },
    });
  }

  /**
   * Mark job as failed.
   */
  async fail(jobId: string, error: unknown) {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorSummary: { message: String(error) },
      },
    });
  }

  /**
   * Mark job as partial (some items succeeded, some failed).
   */
  async partial(jobId: string, result: Record<string, unknown>) {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'partial',
        finishedAt: new Date(),
        result,
      },
    });
  }
}
