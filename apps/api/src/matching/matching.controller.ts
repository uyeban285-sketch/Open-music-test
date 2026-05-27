import { Controller, Get, Post, Param, Body, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { MatchingService } from './matching.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  /** Get pending match decisions */
  @Get('match-pending')
  async getPending(@Req() req: any, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const results = await this.matchingService.getPending(req.userId, cursor, limit ? parseInt(limit) : 20);
    return { status: 'success', data: results };
  }

  /** Batch confirm/reject match decisions */
  @Post('match-decisions')
  async batchDecide(@Req() req: any, @Body() body: { decisions: Array<{ id: string; action: 'confirm' | 'reject' }> }) {
    const results = [];
    for (const decision of body.decisions) {
      if (decision.action === 'confirm') {
        await this.matchingService.confirm(decision.id, req.userId);
      } else {
        await this.matchingService.reject(decision.id, req.userId);
      }
      results.push({ id: decision.id, action: decision.action, status: 'done' });
    }
    return { status: 'success', data: results };
  }

  /** Revert a match decision (within 30 days) */
  @Post('match-decisions/:id/revert')
  async revert(@Req() req: any, @Param('id') id: string) {
    await this.matchingService.revert(id, req.userId);
    return { status: 'success', message: 'Decision reverted' };
  }

  /** Match report */
  @Get('match-report')
  async matchReport(@Req() req: any) {
    // Simplified report — counts by status
    const counts = await Promise.all([
      this.matchingService.getPending(req.userId).then((r) => r.length),
    ]);
    return { status: 'success', data: { pendingCount: counts[0] } };
  }
}
