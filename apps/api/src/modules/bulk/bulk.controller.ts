import { Controller, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BulkService } from './bulk.service.js';
import type { DistributeAutoParams, DistributeStrategyParams, ScheduleParams } from './bulk.types.js';

interface DistributeBody {
  mode: 'AUTO' | 'STRATEGY';
  media: DistributeAutoParams['media'];
  startDate: string;
  endDate?: string;
  platforms?: string[];
  postsPerDay?: Record<string, number>;
  times?: Record<string, string[]>;
}

@ApiTags('bulk')
@Controller('bulk')
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post('distribute')
  @ApiOperation({ summary: 'Generate PostDraft[] preview (not saved)' })
  async distribute(
    @Query('userId') userId: string,
    @Body() body: DistributeBody,
  ) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);

    if (body.mode === 'AUTO') {
      if (!body.endDate) throw new HttpException('endDate required for AUTO mode', HttpStatus.BAD_REQUEST);
      return this.bulkService.distributeAuto({
        media: body.media,
        startDate: body.startDate,
        endDate: body.endDate,
        platforms: body.platforms ?? [],
        postsPerDay: body.postsPerDay ?? {},
        times: body.times ?? {},
      } as DistributeAutoParams);
    }

    return this.bulkService.distributeStrategy({
      media: body.media,
      startDate: body.startDate,
      userId,
    } as DistributeStrategyParams);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Create all posts from filled-in drafts' })
  schedule(@Query('userId') userId: string, @Body() body: { drafts: ScheduleParams['drafts'] }) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.bulkService.scheduleAll({ drafts: body.drafts, userId });
  }
}
