import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service.js';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get stats overview: published, pending, failed, today' })
  @ApiQuery({ name: 'userId', required: true })
  overview(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.statsService.getOverview(userId);
  }

  @Get('by-platform')
  @ApiOperation({ summary: 'Get post counts broken down by social platform' })
  @ApiQuery({ name: 'userId', required: true })
  byPlatform(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.statsService.getByPlatform(userId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get creator dashboard KPIs: followers, engagement, reach, publish success rate' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'period', required: false, description: '7d | 14d | 30d | 90d (default 7d)' })
  dashboard(@Query('userId') userId: string, @Query('period') period?: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.statsService.getDashboard(userId, period);
  }
}
