import {
  Controller, Get, Post, Delete, Query, Param, Body, UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { MetricsService } from './metrics.service.js';

@ApiTags('metrics')
@Controller('metrics')
@UseGuards(WorkspaceGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Trigger a direct sync and return results immediately' })
  async triggerSync(@ActiveWorkspace() workspaceId: string) {
    const results = await this.metricsService.syncAll(workspaceId);
    return { ok: true, workspaceId, results };
  }

  @Get('sync-status')
  @ApiOperation({ summary: 'Get per-platform integration and sync status' })
  async getSyncStatus(@ActiveWorkspace() workspaceId: string) {
    return this.metricsService.getSyncStatus(workspaceId);
  }

  @Get('followers')
  @ApiOperation({ summary: 'Get latest follower counts per platform from DB' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d' })
  async getFollowers(
    @ActiveWorkspace() workspaceId: string,
    @Query('platform') platform?: string,
    @Query('period') period?: string,
  ) {
    return this.metricsService.getLatestFollowers(workspaceId, platform, period);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get real post metrics: likes, reach, impressions from DB' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'engagement | views | likes | comments | shares' })
  async getPosts(
    @ActiveWorkspace() workspaceId: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
    @Query('period') period?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.metricsService.getPostAnalytics(workspaceId, platform, limit ? parseInt(limit, 10) : 25, period, sortBy);
  }

  @Get('post/:platformPostId/history')
  @ApiOperation({ summary: 'Append-only metric history for a single post, ordered for charting' })
  async getPostHistory(
    @Param('platformPostId') platformPostId: string,
    @ActiveWorkspace() workspaceId: string,
  ) {
    return this.metricsService.getPostMetricHistory(workspaceId, platformPostId);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get aggregated metrics summary: followers, posts, reach, engagement' })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platform: INSTAGRAM | FACEBOOK | YOUTUBE | TIKTOK | TWITTER' })
  async getOverview(
    @ActiveWorkspace() workspaceId: string,
    @Query('period') period = '30d',
    @Query('platform') platform?: string,
  ) {
    return this.metricsService.getOverview(workspaceId, period, platform);
  }

  // ── Goals ───────────────────────────────────────────────────────────────────
  @Get('goals')
  @ApiOperation({ summary: 'List growth goals for the active workspace' })
  async getGoals(@ActiveWorkspace() workspaceId: string) {
    return this.metricsService.getGoals(workspaceId);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Create a growth goal' })
  async createGoal(
    @ActiveWorkspace() workspaceId: string,
    @Body() body: { platform: string; metric: string; target: number; deadline: string },
  ) {
    const { platform, metric, target, deadline } = body;
    if (!platform || !metric || !target || !deadline) {
      throw new HttpException('platform, metric, target and deadline are required', HttpStatus.BAD_REQUEST);
    }
    return this.metricsService.createGoal(workspaceId, platform, metric, target, new Date(deadline));
  }

  @Delete('goals/:id')
  @ApiOperation({ summary: 'Delete a growth goal' })
  async deleteGoal(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.metricsService.deleteGoal(id, workspaceId);
  }
}
