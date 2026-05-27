import { Injectable, Logger, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { computeConfidence } from './confidence';
import { extractFlags } from './normalize';

interface TrackRef {
  id: string;
  trackId: string;
  connectorId: string;
  externalId: string;
  track: {
    canonicalTitle: string;
    canonicalArtist: string[];
    canonicalAlbumId: string | null;
    isrc: string | null;
    durationMs: number;
    explicit: boolean;
    isLive: boolean;
  };
}

/**
 * MatchingService — orchestrates track deduplication decisions.
 * Implements Live/Explicit guard (Req 3.7) and threshold logic (Req 3.2-3.4).
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decide if two external refs should be matched.
   * Returns the MatchDecision with status and confidence.
   */
  async decide(refAId: string, refBId: string): Promise<{ status: string; confidence: number; id: string }> {
    const refA = await this.getRefWithTrack(refAId);
    const refB = await this.getRefWithTrack(refBId);

    // Live/Explicit guard (Req 3.7)
    if (refA.track.isLive !== refB.track.isLive || refA.track.explicit !== refB.track.explicit) {
      this.logger.log(`Guard blocked: live/explicit mismatch for refs ${refAId} and ${refBId}`);
      return { status: 'rejected', confidence: 0, id: '' };
    }

    // Compute confidence
    const { confidence, signals } = computeConfidence(
      {
        title: refA.track.canonicalTitle,
        artists: refA.track.canonicalArtist,
        durationMs: refA.track.durationMs,
        isrc: refA.track.isrc,
      },
      {
        title: refB.track.canonicalTitle,
        artists: refB.track.canonicalArtist,
        durationMs: refB.track.durationMs,
        isrc: refB.track.isrc,
      },
    );

    let status: string;
    if (confidence >= 0.9) {
      status = 'auto_merged';
    } else if (confidence >= 0.5) {
      status = 'probable_pending';
    } else {
      // No link — don't create a decision record
      return { status: 'no_link', confidence, id: '' };
    }

    // Create match decision record
    const decision = await this.prisma.matchDecision.create({
      data: {
        leftExternalRefId: refAId,
        rightExternalRefId: refBId,
        confidence,
        signals: signals as any,
        status: status as any,
        decidedBy: 'system',
      },
    });

    // If auto-merged, merge the tracks
    if (status === 'auto_merged') {
      await this.mergeTrack(refA, refB, decision.id);
    }

    return { status, confidence, id: decision.id };
  }

  /**
   * User confirms a probable match.
   */
  async confirm(decisionId: string, userId: string) {
    const decision = await this.prisma.matchDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new BadRequestException('Decision not found');
    if (decision.status !== 'probable_pending') {
      throw new BadRequestException('Can only confirm probable_pending decisions');
    }

    await this.prisma.matchDecision.update({
      where: { id: decisionId },
      data: { status: 'confirmed', decidedBy: 'user', userId },
    });

    // Merge the tracks
    const refA = await this.getRefWithTrack(decision.leftExternalRefId);
    const refB = await this.getRefWithTrack(decision.rightExternalRefId);
    await this.mergeTrack(refA, refB, decisionId);
  }

  /**
   * User rejects a probable match.
   */
  async reject(decisionId: string, userId: string) {
    const decision = await this.prisma.matchDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new BadRequestException('Decision not found');

    await this.prisma.matchDecision.update({
      where: { id: decisionId },
      data: { status: 'rejected', decidedBy: 'user', userId },
    });
  }

  /**
   * Revert a decision (within 30 days).
   */
  async revert(decisionId: string, userId: string) {
    const decision = await this.prisma.matchDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new BadRequestException('Decision not found');

    const daysSinceDecision = (Date.now() - decision.decidedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDecision > 30) {
      throw new BadRequestException('Cannot revert decisions older than 30 days');
    }

    await this.prisma.matchDecision.update({
      where: { id: decisionId },
      data: { status: 'reverted', revertedAt: new Date() },
    });

    // If it was merged, we'd need to unmerge — simplified for now
    this.logger.log(`Decision ${decisionId} reverted by user ${userId}`);
  }

  /**
   * Get all pending matches for a user.
   */
  async getPending(userId: string, cursor?: string, limit = 20) {
    return this.prisma.matchDecision.findMany({
      where: { status: 'probable_pending' },
      orderBy: { decidedAt: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        externalRefs: {
          include: { track: true },
        },
      },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async getRefWithTrack(refId: string): Promise<TrackRef> {
    const ref = await this.prisma.trackExternalRef.findUnique({
      where: { id: refId },
      include: {
        track: {
          select: {
            canonicalTitle: true,
            canonicalArtist: true,
            canonicalAlbumId: true,
            isrc: true,
            durationMs: true,
            explicit: true,
            isLive: true,
          },
        },
      },
    });
    if (!ref) throw new BadRequestException(`External ref ${refId} not found`);
    return ref as TrackRef;
  }

  private async mergeTrack(refA: TrackRef, refB: TrackRef, decisionId: string) {
    // Keep refA's track as the canonical, reassign refB to point to it
    if (refA.trackId !== refB.trackId) {
      await this.prisma.trackExternalRef.update({
        where: { id: refB.id },
        data: { trackId: refA.trackId, matchDecisionId: decisionId },
      });
      // Delete orphan track if no other refs point to it
      const remaining = await this.prisma.trackExternalRef.count({
        where: { trackId: refB.trackId },
      });
      if (remaining === 0) {
        await this.prisma.track.delete({ where: { id: refB.trackId } });
      }
    }
  }
}
