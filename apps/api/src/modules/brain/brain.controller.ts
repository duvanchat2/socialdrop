import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { Queue } from 'bullmq';
import { BrainService } from './brain.service.js';
import { TranscriptionService } from './transcription.service.js';
import { UsageService } from '../usage/usage.service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('brain')
@Controller('content-brain')
@UseGuards(WorkspaceGuard)
export class BrainController {
  constructor(
    private readonly brainService: BrainService,
    private readonly transcriptionService: TranscriptionService,
    private readonly usageService: UsageService,
    @InjectQueue('metrics-collector') private readonly metricsQueue: Queue,
    @InjectQueue('brain-updater') private readonly brainQueue: Queue,
  ) {}

  /** GET /api/content-brain */
  @Get()
  @ApiOperation({ summary: 'Get ContentBrain for the active workspace' })
  getBrain(@ActiveWorkspace() workspaceId: string) {
    return this.brainService.getBrain(workspaceId);
  }

  /** GET /api/content-brain/performance */
  @Get('performance')
  @ApiOperation({ summary: 'Get performance stats + recent viral scripts' })
  getPerformance(@ActiveWorkspace() workspaceId: string) {
    return this.brainService.getPerformance(workspaceId);
  }

  /** GET /api/content-brain/scripts?isViral=true */
  @Get('scripts')
  @ApiOperation({ summary: 'List generated scripts' })
  listScripts(
    @ActiveWorkspace() workspaceId: string,
    @Query('isViral') isViral?: string,
    @Query('platform') platform?: string,
  ) {
    return this.brainService.listScripts(workspaceId, {
      isViral: isViral === 'true' ? true : isViral === 'false' ? false : undefined,
      platform,
    });
  }

  /** POST /api/content-brain/scripts */
  @Post('scripts')
  @ApiOperation({ summary: 'Save a generated script' })
  async createScript(
    @CurrentUser() userId: string,
    @ActiveWorkspace() workspaceId: string,
    @Body() body: any,
  ) {
    await this.usageService.consume(userId, 'script_generation');
    const { workspaceId: _ignored, ...dto } = body;
    return this.brainService.createScript(workspaceId, dto);
  }

  /** PATCH /api/content-brain/scripts/:id/publish */
  @Patch('scripts/:id/publish')
  @ApiOperation({ summary: 'Mark a script as published (link postId)' })
  markPublished(@Param('id') id: string, @ActiveWorkspace() workspaceId: string, @Body() body: { postId: string }) {
    return this.brainService.markPublished(id, workspaceId, body.postId);
  }

  /** POST /api/content-brain/collect-metrics — trigger manual metrics collection */
  @Post('collect-metrics')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger metrics collection job manually' })
  async triggerMetricsCollection() {
    await this.metricsQueue.add('collect-all', {}, { attempts: 2, backoff: { type: 'fixed', delay: 30_000 } });
    return { message: 'Metrics collection job queued' };
  }

  /** POST /api/content-brain/update-brain — trigger brain update for the active workspace */
  @Post('update-brain')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger brain learning update for the active workspace' })
  async triggerBrainUpdate(@ActiveWorkspace() workspaceId: string) {
    await this.brainQueue.add('update-user', { workspaceId }, { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } });
    return { message: 'Brain update job queued', workspaceId };
  }

  /** POST /api/content-brain/test-transcription
   *  Body: { videoUrl: string }
   *  Downloads the video, transcribes with faster-whisper, returns the transcript.
   */
  @Post('test-transcription')
  @ApiOperation({ summary: 'Test local faster-whisper transcription with a video URL' })
  async testTranscription(@Body() body: { videoUrl: string }) {
    const { videoUrl } = body;
    if (!videoUrl) {
      return { error: 'videoUrl is required' };
    }

    const startedAt = Date.now();
    const transcript = await this.transcriptionService.transcribeUrl(videoUrl);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    return {
      ok: true,
      transcript,
      chars: transcript.length,
      elapsedSeconds: parseFloat(elapsed),
      videoUrl,
    };
  }
}
