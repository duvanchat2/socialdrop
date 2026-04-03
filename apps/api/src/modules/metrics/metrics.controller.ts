import {
  Controller, Get, Post, Delete, Query, Param, Body, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Trigger a direct sync and return results immediately' })
  @ApiQuery({ name: 'userId', required: false })
  async triggerSync(@Query('userId') userId = 'demo-user') {
    const results = await this.metricsService.syncAll(userId);
    return { ok: true, userId, results };
  }

  @Get('sync-status')
  @ApiOperation({ summary: 'Get per-platform integration and sync status' })
  @ApiQuery({ name: 'userId', required: false })
  async getSyncStatus(@Query('userId') userId = 'demo-user') {
    return this.metricsService.getSyncStatus(userId);
  }

  @Get('followers')
  @ApiOperation({ summary: 'Get latest follower counts per platform from DB' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d' })
  async getFollowers(
    @Query('userId') userId: string,
    @Query('platform') platform?: string,
    @Query('period') period?: string,
  ) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.metricsService.getLatestFollowers(userId, platform, period);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get real post metrics: likes, reach, impressions from DB' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'engagement | views | likes | comments | shares' })
  async getPosts(
    @Query('userId') userId: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
    @Query('period') period?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.metricsService.getPostAnalytics(userId, platform, limit ? parseInt(limit, 10) : 25, period, sortBy);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get aggregated metrics summary: followers, posts, reach, engagement' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platform: INSTAGRAM | FACEBOOK | YOUTUBE | TIKTOK | TWITTER' })
  async getOverview(
    @Query('userId') userId: string,
    @Query('period') period = '30d',
    @Query('platform') platform?: string,
  ) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.metricsService.getOverview(userId, period, platform);
  }

  // ── Goals ───────────────────────────────────────────────────────────────────
  @Get('goals')
  @ApiOperation({ summary: 'List growth goals for a user' })
  @ApiQuery({ name: 'userId', required: true })
  async getGoals(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.metricsService.getGoals(userId);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Create a growth goal' })
  async createGoal(
    @Body() body: { userId: string; platform: string; metric: string; target: number; deadline: string },
  ) {
    const { userId, platform, metric, target, deadline } = body;
    if (!userId || !platform || !metric || !target || !deadline) {
      throw new HttpException('userId, platform, metric, target and deadline are required', HttpStatus.BAD_REQUEST);
    }
    return this.metricsService.createGoal(userId, platform, metric, target, new Date(deadline));
  }

  @Delete('goals/:id')
  @ApiOperation({ summary: 'Delete a growth goal' })
  async deleteGoal(@Param('id') id: string) {
    return this.metricsService.deleteGoal(id);
  }
}
