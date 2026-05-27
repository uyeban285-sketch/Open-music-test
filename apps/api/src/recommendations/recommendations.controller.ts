import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly recoService: RecommendationsService) {}

  /** Get all recommendation categories */
  @Get()
  async getAll(@Req() req: any) {
    const data = await this.recoService.getAllCategories(req.userId);
    return { status: 'success', data };
  }

  /** Get recommendations by category */
  @Get('category/:category')
  async getByCategory(
    @Req() req: any,
    @Param('category') category: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.recoService.getByCategory(
      req.userId,
      category,
      limit ? parseInt(limit) : 20,
    );
    return { status: 'success', data };
  }

  /** Record feedback on a recommendation */
  @Post('feedback')
  async feedback(
    @Req() req: any,
    @Body() body: { trackId: string; action: 'play' | 'save' | 'like' | 'skip' | 'dislike' },
  ) {
    await this.recoService.recordFeedback(req.userId, body.trackId, body.action);
    return { status: 'success' };
  }

  /** Generate Smart Mix */
  @Post('smart-mix')
  async smartMix(@Req() req: any, @Body() body: { type: string; seed?: string }) {
    const data = await this.recoService.generateSmartMix(req.userId, body);
    return { status: 'success', data };
  }

  /** Discovery Mode recommendations */
  @Post('discovery')
  async discovery(
    @Req() req: any,
    @Body()
    body: { familiarity: number; riskiness: number; novelty: number; excludedGenres: string[] },
  ) {
    const data = await this.recoService.getDiscoveryRecommendations(req.userId, body);
    return { status: 'success', data };
  }
}
