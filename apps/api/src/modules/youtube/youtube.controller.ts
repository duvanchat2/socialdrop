import {
  Controller, Get, Post, Delete, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { YoutubeService } from './youtube.service.js';

@ApiTags('youtube')
@Controller('youtube')
@UseGuards(WorkspaceGuard)
export class YoutubeController {
  constructor(private readonly youtube: YoutubeService) {}

  // ── Manual poll ───────────────────────────────────────────────────────────

  @Post('poll')
  @ApiOperation({ summary: 'Manually trigger YouTube comment polling' })
  poll(@ActiveWorkspace() workspaceId: string) {
    return this.youtube.pollComments(workspaceId);
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  @Get('comments')
  @ApiOperation({ summary: 'List stored YouTube comments' })
  @ApiQuery({ name: 'videoId', required: false })
  @ApiQuery({ name: 'onlyUnreplied', required: false })
  @ApiQuery({ name: 'onlyShorts', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getComments(
    @ActiveWorkspace() workspaceId: string,
    @Query('videoId') videoId?: string,
    @Query('onlyUnreplied') onlyUnreplied?: string,
    @Query('onlyShorts') onlyShorts?: string,
    @Query('limit') limit?: string,
  ) {
    return this.youtube.getComments(
      workspaceId,
      videoId,
      onlyUnreplied === 'true',
      onlyShorts === 'true',
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Comment stats for the active workspace' })
  getStats(@ActiveWorkspace() workspaceId: string) {
    return this.youtube.getStats(workspaceId);
  }

  @Post('comments/:commentId/reply')
  @ApiOperation({ summary: 'Post a manual reply to a YouTube comment' })
  async replyToComment(
    @Param('commentId') commentId: string,
    @ActiveWorkspace() workspaceId: string,
    @Body('text') text: string,
  ) {
    await this.youtube.replyToComment(workspaceId, commentId, text);
    return { ok: true };
  }

  // ── Auto-reply rules ──────────────────────────────────────────────────────

  @Get('auto-replies')
  @ApiOperation({ summary: 'List auto-reply keyword rules' })
  getAutoReplies(@ActiveWorkspace() workspaceId: string) {
    return this.youtube.getAutoReplies(workspaceId);
  }

  @Post('auto-replies')
  @ApiOperation({ summary: 'Create an auto-reply rule' })
  createAutoReply(
    @ActiveWorkspace() workspaceId: string,
    @Body('keyword') keyword: string,
    @Body('replyTemplate') replyTemplate: string,
  ) {
    return this.youtube.createAutoReply(workspaceId, keyword, replyTemplate);
  }

  @Patch('auto-replies/:id/toggle')
  @ApiOperation({ summary: 'Toggle auto-reply rule on/off' })
  toggleAutoReply(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.youtube.toggleAutoReply(id, workspaceId);
  }

  @Delete('auto-replies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an auto-reply rule' })
  deleteAutoReply(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.youtube.deleteAutoReply(id, workspaceId);
  }
}
