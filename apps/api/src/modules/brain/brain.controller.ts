import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BrainService } from './brain.service.js';
import { TranscriptionService } from './transcription.service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('brain')
@Controller('content-brain')
export class BrainController {
  constructor(
    private readonly brainService: BrainService,
    private readonly transcriptionService: TranscriptionService,
    @InjectQueue('metrics-collector') private readonly metricsQueue: Queue,
    @InjectQueue('brain-updater') private readonly brainQueue: Queue,
  ) {}

  /** GET /api/content-brain?userId=xxx */
  @Get()
  @ApiOperation({ summary: 'Get ContentBrain for a user' })
  getBrain(@Query('userId') userId = 'demo-user') {
    return this.brainService.getBrain(userId);
  }

  /** GET /api/content-brain/performance?userId=xxx */
  @Get('performance')
  @ApiOperation({ summary: 'Get performance stats + recent viral scripts' })
  getPerformance(@Query('userId') userId = 'demo-user') {
    return this.brainService.getPerformance(userId);
  }

  /** GET /api/content-brain/scripts?userId=xxx&isViral=true */
  @Get('scripts')
  @ApiOperation({ summary: 'List generated scripts' })
  listScripts(
    @Query('userId') userId = 'demo-user',
    @Query('isViral') isViral?: string,
    @Query('platform') platform?: string,
  ) {
    return this.brainService.listScripts(userId, {
      isViral: isViral === 'true' ? true : isViral === 'false' ? false : undefined,
      platform,
    });
  }

  /** POST /api/content-brain/scripts */
  @Post('scripts')
  @ApiOperation({ summary: 'Save a generated script' })
  createScript(@Body() body: any) {
    const { userId = 'demo-user', ...dto } = body;
    return this.brainService.createScript(userId, dto);
  }

  /** PATCH /api/content-brain/scripts/:id/publish */
  @Patch('scripts/:id/publish')
  @ApiOperation({ summary: 'Mark a script as published (link postId)' })
  markPublished(@Param('id') id: string, @Body() body: { postId: string }) {
    return this.brainService.markPublished(id, body.postId);
  }

  /** POST /api/content-brain/collect-metrics — trigger manual metrics collection */
  @Post('collect-metrics')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger metrics collection job manually' })
  async triggerMetricsCollection() {
    await this.metricsQueue.add('collect-all', {}, { attempts: 2, backoff: { type: 'fixed', delay: 30_000 } });
    return { message: 'Metrics collection job queued' };
  }

  /** POST /api/content-brain/update-brain — trigger brain update for a user */
  @Post('update-brain')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger brain learning update for a user' })
  async triggerBrainUpdate(@Body() body: { userId?: string }) {
    const userId = body.userId ?? 'demo-user';
    await this.brainQueue.add('update-user', { userId }, { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } });
    return { message: 'Brain update job queued', userId };
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
