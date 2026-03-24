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
}
