import {
  Controller, Get, Post, Delete, Body, Param, Query, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CompetitorsService } from './competitors.service.js';

@ApiTags('competitors')
@Controller('competitors')
export class CompetitorsController {
  constructor(private readonly competitorsService: CompetitorsService) {}

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

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a tracked competitor' })
  async remove(@Param('id') id: string) {
    return this.competitorsService.remove(id);
  }

  /**
   * Receive scraped data from the Chrome extension.
   * Body: { userId, platform, profile: {...}, posts: [...] }
   */
  @Post('ingest')
  @ApiOperation({ summary: 'Ingest scraped competitor data from Chrome extension' })
  async ingest(@Body() body: {
    userId: string;
    platform: string;
    profile: {
      username: string;
      displayName?: string;
      followers?: number;
      following?: number;
      postsCount?: number;
      bio?: string;
      avatar?: string;
    };
    posts: Array<{
      postId: string;
      caption?: string;
      mediaType?: string;
      likes?: number;
      comments?: number;
      hashtags?: string[];
      publishedAt?: string;
      thumbnail?: string;
      url?: string;
    }>;
  }) {
    if (!body.userId || !body.profile?.username) {
      throw new HttpException('userId and profile.username are required', HttpStatus.BAD_REQUEST);
    }
    return this.competitorsService.ingest({ platform: 'INSTAGRAM', ...body });
  }

  /**
   * Data-driven analysis of ingested posts (no AI call needed).
   */
  @Get(':id/analysis')
  @ApiOperation({ summary: 'Get data-driven analysis from ingested posts' })
  async getAnalysis(@Param('id') id: string) {
    return this.competitorsService.analyzeFromPosts(id);
  }

  /**
   * AI-powered analysis (uses ZAI API).
   */
  @Post(':id/analyze')
  @ApiOperation({ summary: 'Run AI analysis on a competitor profile' })
  @ApiQuery({ name: 'userId', required: true })
  async analyze(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.analyze(id, userId);
  }

  /**
   * Trends across all tracked competitors.
   */
  @Get('trends')
  @ApiOperation({ summary: 'Get aggregated trends across all competitors' })
  @ApiQuery({ name: 'userId', required: true })
  async trends(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.getTrends(userId);
  }

  @Get('benchmark')
  @ApiOperation({ summary: 'Compare user metrics vs all tracked competitors' })
  @ApiQuery({ name: 'userId', required: true })
  async benchmark(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.benchmark(userId);
  }
}
