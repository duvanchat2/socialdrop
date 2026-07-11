import { Controller, Post, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
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
@UseGuards(WorkspaceGuard)
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post('distribute')
  @ApiOperation({ summary: 'Generate PostDraft[] preview (not saved)' })
  async distribute(
    @ActiveWorkspace() workspaceId: string,
    @Body() body: DistributeBody,
  ) {
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
      workspaceId,
    } as DistributeStrategyParams);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Create all posts from filled-in drafts' })
  schedule(@ActiveWorkspace() workspaceId: string, @Body() body: { drafts: ScheduleParams['drafts'] }) {
    return this.bulkService.scheduleAll({ drafts: body.drafts, workspaceId });
  }
}
