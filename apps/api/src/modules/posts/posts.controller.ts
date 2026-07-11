import {
  Controller, Get, Post, Patch, Body, Param, Query, Delete, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ActiveWorkspace } from '../workspaces/active-workspace.decorator.js';
import { WorkspaceGuard } from '../workspaces/workspace.guard.js';
import { PostsService } from './posts.service.js';
import { CreatePostDto, UpdatePostDto } from '@socialdrop/shared';

@ApiTags('posts')
@Controller('posts')
@UseGuards(WorkspaceGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and schedule a post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  create(@ActiveWorkspace() workspaceId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List posts with optional filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  findAll(
    @ActiveWorkspace() workspaceId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.postsService.findAll(workspaceId, {
      status: status as any,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get posts for calendar view' })
  calendar(
    @ActiveWorkspace() workspaceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.postsService.getCalendar(workspaceId, new Date(from), new Date(to));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post detail with integrations' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  findOne(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.postsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update post caption/date/platforms' })
  update(@Param('id') id: string, @ActiveWorkspace() workspaceId: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel and delete a post' })
  remove(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.postsService.remove(id, workspaceId);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed post' })
  retry(@Param('id') id: string, @ActiveWorkspace() workspaceId: string) {
    return this.postsService.retry(id, workspaceId);
  }
}
