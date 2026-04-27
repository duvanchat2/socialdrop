import {
  Controller, Get, Post, Delete, Body, Param, Query, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CompetitorsService } from './competitors.service.js';
import { TranscriptionService } from '../brain/transcription.service.js';

@ApiTags('competitors')
@Controller('competitors')
export class CompetitorsController {
  constructor(
    private readonly competitorsService: CompetitorsService,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tracked competitors for a user' })
  @ApiQuery({ name: 'userId', required: true })
  async list(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a competitor to track' })
  async add(@Body() body: { userId: string; username: string; platform: string }) {
    const { userId, username, platform } = body;
    if (!userId || !username || !platform) {
      throw new HttpException('userId, username and platform are required', HttpStatus.BAD_REQUEST);
    }
    return this.competitorsService.add(userId, username, platform);
  }

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest a scraped competitor profile + posts (Chrome extension)' })
  async ingest(
    @Body()
    body: {
      userId: string;
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
      }>;
    },
  ) {
    const { userId, platform, profile, posts } = body;
    if (!userId || !platform || !profile?.username) {
      throw new HttpException(
        'userId, platform and profile.username are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.competitorsService.ingest(userId, platform, profile, posts ?? []);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a tracked competitor' })
  async remove(@Param('id') id: string) {
    return this.competitorsService.remove(id);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Run AI analysis on a competitor' })
  @ApiQuery({ name: 'userId', required: true })
  async analyze(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.analyze(id, userId);
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
  @ApiOperation({ summary: 'Compare user metrics vs all tracked competitors' })
  @ApiQuery({ name: 'userId', required: true })
  async benchmark(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.benchmark(userId);
  }
}
