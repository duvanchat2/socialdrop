import {
  Controller, Get, Post, Query, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MetricsService } from './metrics.service.js';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    @InjectQueue('metrics-sync') private readonly syncQueue: Queue,
  ) {}

  @Post('sync')
  @ApiOperation({ summary: 'Trigger a manual metrics sync for all platforms' })
  @ApiQuery({ name: 'userId', required: false })
  async triggerSync(@Query('userId') userId = 'demo-user') {
    await this.syncQueue.add('sync-all', { userId });
    return { queued: true, userId, message: 'Sync job enqueued' };
  }

  @Get('followers')
  @ApiOperation({ summary: 'Get latest follower counts per platform from DB' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'platform', required: false })
  async getFollowers(
    @Query('userId') userId: string,
    @Query('platform') platform?: string,
  ) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.metricsService.getLatestFollowers(userId, platform);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get real post metrics: likes, reach, impressions from DB' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getPosts(
    @Query('userId') userId: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.metricsService.getPostAnalytics(userId, platform, limit ? parseInt(limit, 10) : 25);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get aggregated metrics summary: followers, posts, reach, engagement' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'period', required: false, description: '7d | 30d | 90d' })
  async getOverview(
    @Query('userId') userId: string,
    @Query('period') period = '30d',
  ) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.metricsService.getOverview(userId, period);
  }
}
