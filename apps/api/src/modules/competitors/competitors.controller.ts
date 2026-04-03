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

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Run AI analysis on a competitor' })
  @ApiQuery({ name: 'userId', required: true })
  async analyze(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.analyze(id, userId);
  }

  @Get('benchmark')
  @ApiOperation({ summary: 'Compare user metrics vs all tracked competitors' })
  @ApiQuery({ name: 'userId', required: true })
  async benchmark(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    return this.competitorsService.benchmark(userId);
  }
}
