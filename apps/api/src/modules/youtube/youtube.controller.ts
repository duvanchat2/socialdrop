import {
  Controller, Get, Post, Delete, Patch, Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { YoutubeService } from './youtube.service.js';

@ApiTags('youtube')
@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtube: YoutubeService) {}

  // ── Manual poll ───────────────────────────────────────────────────────────

  @Post('poll')
  @ApiOperation({ summary: 'Manually trigger YouTube comment polling' })
  @ApiQuery({ name: 'userId', required: false })
  poll(@Query('userId') userId = 'demo-user') {
    return this.youtube.pollComments(userId);
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  @Get('comments')
  @ApiOperation({ summary: 'List stored YouTube comments' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'videoId', required: false })
  @ApiQuery({ name: 'onlyUnreplied', required: false })
  @ApiQuery({ name: 'onlyShorts', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getComments(
    @Query('userId') userId = 'demo-user',
    @Query('videoId') videoId?: string,
    @Query('onlyUnreplied') onlyUnreplied?: string,
    @Query('onlyShorts') onlyShorts?: string,
    @Query('limit') limit?: string,
  ) {
    return this.youtube.getComments(
      userId,
      videoId,
      onlyUnreplied === 'true',
      onlyShorts === 'true',
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Comment stats for a user' })
  @ApiQuery({ name: 'userId', required: false })
  getStats(@Query('userId') userId = 'demo-user') {
    return this.youtube.getStats(userId);
  }

  @Post('comments/:commentId/reply')
  @ApiOperation({ summary: 'Post a manual reply to a YouTube comment' })
  async replyToComment(
    @Param('commentId') commentId: string,
    @Body('userId') userId = 'demo-user',
    @Body('text') text: string,
  ) {
    await this.youtube.replyToComment(userId, commentId, text);
    return { ok: true };
  }

  // ── Auto-reply rules ──────────────────────────────────────────────────────

  @Get('auto-replies')
  @ApiOperation({ summary: 'List auto-reply keyword rules' })
  @ApiQuery({ name: 'userId', required: false })
  getAutoReplies(@Query('userId') userId = 'demo-user') {
    return this.youtube.getAutoReplies(userId);
  }

  @Post('auto-replies')
  @ApiOperation({ summary: 'Create an auto-reply rule' })
  createAutoReply(
    @Body('userId') userId = 'demo-user',
    @Body('keyword') keyword: string,
    @Body('replyTemplate') replyTemplate: string,
  ) {
    return this.youtube.createAutoReply(userId, keyword, replyTemplate);
  }

  @Patch('auto-replies/:id/toggle')
  @ApiOperation({ summary: 'Toggle auto-reply rule on/off' })
  @ApiQuery({ name: 'userId', required: false })
  toggleAutoReply(@Param('id') id: string, @Query('userId') userId = 'demo-user') {
    return this.youtube.toggleAutoReply(id, userId);
  }

  @Delete('auto-replies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an auto-reply rule' })
  @ApiQuery({ name: 'userId', required: false })
  deleteAutoReply(@Param('id') id: string, @Query('userId') userId = 'demo-user') {
    return this.youtube.deleteAutoReply(id, userId);
  }
}
