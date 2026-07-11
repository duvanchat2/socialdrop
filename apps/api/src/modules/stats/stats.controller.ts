import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service.js';

@ApiTags('stats')
@Controller('stats')
@UseGuards(WorkspaceGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get stats overview: published, pending, failed, today' })
  overview(@ActiveWorkspace() workspaceId: string) {
    return this.statsService.getOverview(workspaceId);
  }

  @Get('by-platform')
  @ApiOperation({ summary: 'Get post counts broken down by social platform' })
  byPlatform(@ActiveWorkspace() workspaceId: string) {
    return this.statsService.getByPlatform(workspaceId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get creator dashboard KPIs: followers, engagement, reach, publish success rate' })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d (default 7d)' })
  dashboard(@ActiveWorkspace() workspaceId: string, @Query('period') period?: string) {
    return this.statsService.getDashboard(workspaceId, period);
  }

  @Get('best-times')
  @ApiOperation({ summary: 'Get best day/hour slots to publish based on historical engagement' })
  @ApiQuery({ name: 'platform', required: false })
  bestTimes(@ActiveWorkspace() workspaceId: string, @Query('platform') platform?: string) {
    return this.statsService.getBestTimes(workspaceId, platform);
  }
}
