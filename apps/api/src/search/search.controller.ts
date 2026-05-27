import { Controller, Get, Query as QueryParam, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** Semantic search — natural language query */
  @Get()
  async search(
    @Req() req: any,
    @QueryParam('q') query: string,
    @QueryParam('genre') genre?: string,
    @QueryParam('mood') mood?: string,
    @QueryParam('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      return { status: 'fail', message: 'Query parameter "q" is required' };
    }

    const filters = { genre, mood };
    const results = await this.searchService.search(
      query,
      req.userId,
      filters,
      limit ? parseInt(limit) : 30,
    );
    return { status: 'success', data: results };
  }

  /** Autocomplete suggestions */
  @Get('suggest')
  async suggest(@QueryParam('q') query: string) {
    if (!query || query.length < 2) {
      return { status: 'success', data: [] };
    }

    const suggestions = await this.searchService.suggest(query);
    return { status: 'success', data: suggestions };
  }
}
