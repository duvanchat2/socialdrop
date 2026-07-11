import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { CompetitorsService } from './competitors.service.js';
import { TranscriptionService } from '../brain/transcription.service.js';
import { UsageService } from '../usage/usage.service.js';

@ApiTags('competitors')
@Controller('competitors')
@UseGuards(WorkspaceGuard)
export class CompetitorsController {
  constructor(
    private readonly competitorsService: CompetitorsService,
    private readonly transcriptionService: TranscriptionService,
    private readonly usageService: UsageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tracked competitors for the active workspace' })
  async list(@ActiveWorkspace() workspaceId: string) {
    return this.competitorsService.list(workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a competitor to track' })
  async add(
    @ActiveWorkspace() workspaceId: string,
    @Body() body: { username: string; platform: string },
  ) {
    const { username, platform } = body;
    if (!username || !platform) {
      throw new HttpException('username and platform are required', HttpStatus.BAD_REQUEST);
    }
    return this.competitorsService.add(workspaceId, username, platform);
  }

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest a scraped competitor profile + posts (Chrome extension)' })
  async ingest(
    @ActiveWorkspace() workspaceId: string,
    @Body()
    body: {
      platform: string;
      profile: {
        username: string;
        displayName?: string;
        bio?: string;
        followers?: number;
        following?: number;
        url?: string;
      };
      posts: Array<{
        postId: string;
        url: string;
        thumbnail?: string;
        isReel?: boolean;
        likes?: number;
        comments?: number;
        views?: number;
        caption?: string;
      }>;
    },
  ) {
    const { platform, profile, posts } = body;
    if (!platform || !profile?.username) {
      throw new HttpException(
        'platform and profile.username are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.competitorsService.ingest(workspaceId, platform, profile, posts ?? []);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a tracked competitor' })
  async remove(@Param('id') id: string) {
    return this.competitorsService.remove(id);
  }

  @Post(':id/summary')
  @ApiOperation({ summary: 'Run profile-level AI summary (legacy ZAI-based) for a competitor' })
  async summary(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.competitorsService.analyze(id, workspaceId);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Queue per-video transcription + Claude analysis for all reels' })
  async analyze(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() body: { postIds?: string[] } = {},
  ) {
    await this.usageService.consume(userId, 'competitor_analysis');
    const { queued } = await this.competitorsService.queueVideoAnalysis(id, body.postIds);
    return { queued, message: `Analizando ${queued} videos...` };
  }

  @Get(':id/videos')
  @ApiOperation({ summary: 'List competitor posts/videos with analysis status' })
  async videos(@Param('id') id: string) {
    return this.competitorsService.listVideos(id);
  }

  @Post('transcribe')
  @ApiOperation({ summary: 'Transcribe a video URL using faster-whisper' })
  async transcribe(@Body() body: { videoUrl: string }) {
    const { videoUrl } = body;
    if (!videoUrl || !/^https?:\/\//.test(videoUrl)) {
      throw new HttpException('videoUrl (http/https) is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const transcript = await this.transcriptionService.transcribeUrl(videoUrl);
      return { transcript };
    } catch (err) {
      throw new HttpException(
        `Transcription failed: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get('benchmark')
  @ApiOperation({ summary: 'Compare workspace metrics vs all tracked competitors' })
  async benchmark(@ActiveWorkspace() workspaceId: string) {
    return this.competitorsService.benchmark(workspaceId);
  }
}
